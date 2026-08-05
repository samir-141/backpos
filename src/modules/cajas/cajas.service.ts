import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AperturaCajaDto,
  CierreCajaDto,
  MovimientoCajaDto,
} from './dto/cajas.dto';
import { RealtimeService } from '../../socket/realtime.service';

interface CajaContext {
  boticaId: string;
  usuarioId: string;
  sucursalId: string;
}

@Injectable()
export class CajasService {
  private readonly logger = new Logger(CajasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private async resolveContext(
    boticaId: string,
    usuarioId?: string,
    sucursalId?: string,
  ): Promise<CajaContext> {
    if (!usuarioId) {
      throw new ForbiddenException(
        'No se pudo identificar al usuario autenticado.',
      );
    }
    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        id: usuarioId,
        botica_id: boticaId,
        estado: 'ACTIVO',
        deleted_at: null,
      },
      select: { id: true },
    });
    if (!usuario) {
      throw new ForbiddenException(
        'El usuario no está activo en la botica actual.',
      );
    }

    const asignacion = await this.prisma.usuario_sucursales.findFirst({
      where: {
        usuario_id: usuarioId,
        botica_id: boticaId,
        activo: true,
        ...(sucursalId ? { sucursal_id: sucursalId } : {}),
        sucursales: { botica_id: boticaId, deleted_at: null },
      },
      orderBy: [{ es_principal: 'desc' }, { created_at: 'asc' }],
      select: { sucursal_id: true },
    });
    if (!asignacion) {
      throw new ForbiddenException(
        sucursalId
          ? 'La sucursal no está asignada al usuario autenticado.'
          : 'El usuario no tiene una sucursal activa asignada.',
      );
    }
    return { boticaId, usuarioId, sucursalId: asignacion.sucursal_id };
  }

  private async lockSucursal(tx: any, context: CajaContext): Promise<void> {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      `caja:${context.boticaId}:${context.sucursalId}`,
    );
  }

  private async getOrCreateCaja(tx: any, context: CajaContext) {
    let caja = await tx.cajas.findFirst({
      where: {
        sucursal_id: context.sucursalId,
        botica_id: context.boticaId,
        deleted_at: null,
      },
      orderBy: { created_at: 'asc' },
    });
    if (caja) return caja;

    const sucursal = await tx.sucursales.findFirst({
      where: {
        id: context.sucursalId,
        botica_id: context.boticaId,
        deleted_at: null,
      },
      select: { nombre: true },
    });
    if (!sucursal) {
      throw new ForbiddenException(
        'La sucursal asignada ya no está disponible.',
      );
    }
    caja = await tx.cajas.create({
      data: {
        sucursal_id: context.sucursalId,
        botica_id: context.boticaId,
        nombre: `Caja Principal - ${sucursal.nombre}`,
        estado: 'CERRADA',
        created_by: context.usuarioId,
      },
    });
    return caja;
  }

  private async buildEstado(tx: any, caja: any) {
    if (caja.estado === 'CERRADA') {
      return {
        caja_id: caja.id,
        nombre: caja.nombre,
        estado: 'CERRADA',
        monto_inicial: 0,
        efectivo_esperado: 0,
        ventas_efectivo: 0,
        ventas_digitales: 0,
        desglose_metodos: [],
        ingresos_manuales: 0,
        egresos_manuales: 0,
        operaciones_count: 0,
        fecha_apertura: null,
      };
    }

    const ultimaApertura = await tx.movimientos_caja.findFirst({
      where: { caja_id: caja.id, tipo: 'APERTURA', deleted_at: null },
      orderBy: { fecha: 'desc' },
    });
    const fechaApertura = ultimaApertura?.fecha || new Date();
    const montoInicial = Number(ultimaApertura?.monto || 0);
    const [movimientos, ventas] = await Promise.all([
      tx.movimientos_caja.findMany({
        where: {
          caja_id: caja.id,
          fecha: { gte: fechaApertura },
          deleted_at: null,
        },
      }),
      tx.ventas.findMany({
        where: {
          caja_id: caja.id,
          fecha: { gte: fechaApertura },
          deleted_at: null,
        },
        include: { pagos: { include: { metodos_pago: true } } },
      }),
    ]);

    let ingresosManuales = 0;
    let egresosManuales = 0;
    for (const movimiento of movimientos) {
      if (movimiento.tipo === 'INGRESO')
        ingresosManuales += Number(movimiento.monto);
      if (movimiento.tipo === 'EGRESO')
        egresosManuales += Number(movimiento.monto);
    }

    let ventasEfectivo = 0;
    let ventasDigitales = 0;
    const metodos = new Map<string, number>();
    for (const venta of ventas) {
      for (const pago of venta.pagos) {
        const nombre = (pago.metodos_pago?.nombre || 'EFECTIVO').toUpperCase();
        const monto = Number(pago.monto);
        metodos.set(nombre, (metodos.get(nombre) || 0) + monto);
        if (nombre.includes('EFECTIVO')) ventasEfectivo += monto;
        else ventasDigitales += monto;
      }
    }

    return {
      caja_id: caja.id,
      nombre: caja.nombre,
      estado: 'ABIERTA',
      monto_inicial: montoInicial,
      efectivo_esperado:
        montoInicial + ventasEfectivo + ingresosManuales - egresosManuales,
      ventas_efectivo: ventasEfectivo,
      ventas_digitales: ventasDigitales,
      desglose_metodos: Array.from(metodos, ([metodo, monto]) => ({
        metodo,
        monto,
      })),
      ingresos_manuales: ingresosManuales,
      egresos_manuales: egresosManuales,
      operaciones_count: ventas.length,
      fecha_apertura: fechaApertura.toISOString(),
    };
  }

  async getEstadoCaja(
    boticaId: string,
    usuarioId?: string,
    sucursalId?: string,
  ) {
    const context = await this.resolveContext(boticaId, usuarioId, sucursalId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockSucursal(tx, context);
      const caja = await this.getOrCreateCaja(tx, context);
      return this.buildEstado(tx, caja);
    });
  }

  async aperturarCaja(
    boticaId: string,
    usuarioId?: string,
    sucursalId?: string,
    dto?: AperturaCajaDto,
  ) {
    const context = await this.resolveContext(
      boticaId,
      usuarioId,
      dto?.sucursal_id || sucursalId,
    );
    const montoInicial = dto?.monto_inicial ?? 0;
    const caja = await this.prisma.$transaction(async (tx) => {
      await this.lockSucursal(tx, context);
      const actual = await this.getOrCreateCaja(tx, context);
      const transition = await tx.cajas.updateMany({
        where: {
          id: actual.id,
          botica_id: boticaId,
          sucursal_id: context.sucursalId,
          estado: 'CERRADA',
          deleted_at: null,
        },
        data: { estado: 'ABIERTA', updated_by: context.usuarioId },
      });
      if (transition.count !== 1) {
        throw new BadRequestException('La caja ya se encuentra ABIERTA.');
      }
      await tx.movimientos_caja.create({
        data: {
          caja_id: actual.id,
          botica_id: boticaId,
          usuario_id: context.usuarioId,
          tipo: 'APERTURA',
          monto: montoInicial,
          observacion: dto?.observacion || 'Apertura de turno',
          created_by: context.usuarioId,
        },
      });
      return actual;
    });

    this.realtimeService.notificarCajaAperturada(
      context.sucursalId,
      caja.id,
      context.usuarioId,
      montoInicial,
    );
    return {
      mensaje: 'Caja aperturada exitosamente',
      caja_id: caja.id,
      monto_inicial: montoInicial,
    };
  }

  async registrarMovimiento(
    boticaId: string,
    usuarioId?: string,
    sucursalId?: string,
    dto?: MovimientoCajaDto,
  ) {
    if (!dto) throw new BadRequestException('Datos de movimiento requeridos.');
    const context = await this.resolveContext(
      boticaId,
      usuarioId,
      dto.sucursal_id || sucursalId,
    );
    const movimiento = await this.prisma.$transaction(async (tx) => {
      await this.lockSucursal(tx, context);
      const caja = await this.getOrCreateCaja(tx, context);
      const abierta = await tx.cajas.count({
        where: { id: caja.id, estado: 'ABIERTA', deleted_at: null },
      });
      if (abierta !== 1) {
        throw new BadRequestException(
          'Debes aperturar la caja para registrar movimientos.',
        );
      }
      return tx.movimientos_caja.create({
        data: {
          caja_id: caja.id,
          botica_id: boticaId,
          usuario_id: context.usuarioId,
          tipo: dto.tipo,
          monto: dto.monto,
          observacion: dto.observacion,
          created_by: context.usuarioId,
        },
      });
    });
    return {
      mensaje: `Movimiento de ${dto.tipo} registrado correctamente`,
      movimiento,
    };
  }

  async cerrarCaja(
    boticaId: string,
    usuarioId?: string,
    sucursalId?: string,
    dto?: CierreCajaDto,
  ) {
    const context = await this.resolveContext(
      boticaId,
      usuarioId,
      dto?.sucursal_id || sucursalId,
    );
    const efectivoContado = dto?.efectivo_contado ?? 0;
    const cierre = await this.prisma.$transaction(async (tx) => {
      await this.lockSucursal(tx, context);
      const caja = await this.getOrCreateCaja(tx, context);
      if (caja.estado !== 'ABIERTA') {
        throw new BadRequestException('La caja ya se encuentra CERRADA.');
      }
      const estado = await this.buildEstado(tx, caja);
      const transition = await tx.cajas.updateMany({
        where: {
          id: caja.id,
          botica_id: boticaId,
          sucursal_id: context.sucursalId,
          estado: 'ABIERTA',
          deleted_at: null,
        },
        data: { estado: 'CERRADA', updated_by: context.usuarioId },
      });
      if (transition.count !== 1) {
        throw new BadRequestException('La caja ya se encuentra CERRADA.');
      }

      const diferencia = efectivoContado - estado.efectivo_esperado;
      const tipoDiferencia =
        diferencia > 0 ? 'SOBRANTE' : diferencia < 0 ? 'FALTANTE' : 'EXACTO';
      await tx.movimientos_caja.create({
        data: {
          caja_id: caja.id,
          botica_id: boticaId,
          usuario_id: context.usuarioId,
          tipo: 'CIERRE',
          monto: efectivoContado,
          observacion: `${dto?.observacion || 'Cierre de turno (Corte Z)'} | [${tipoDiferencia}: S/ ${Math.abs(diferencia).toFixed(2)}]`,
          created_by: context.usuarioId,
        },
      });
      return {
        caja,
        resumen: {
          caja_id: caja.id,
          nombre_caja: caja.nombre,
          fecha_cierre: new Date().toISOString(),
          fecha_apertura: estado.fecha_apertura,
          monto_inicial: estado.monto_inicial,
          ventas_efectivo: estado.ventas_efectivo,
          ventas_digitales: estado.ventas_digitales,
          desglose_metodos: estado.desglose_metodos,
          ingresos_manuales: estado.ingresos_manuales,
          egresos_manuales: estado.egresos_manuales,
          efectivo_esperado: estado.efectivo_esperado,
          efectivo_contado: efectivoContado,
          diferencia,
          tipo_diferencia: tipoDiferencia,
          operaciones_count: estado.operaciones_count,
          observacion: dto?.observacion || 'Ninguna',
        },
      };
    });

    this.realtimeService.notificarCajaCerrada(
      context.sucursalId,
      cierre.caja.id,
      cierre.resumen,
    );
    return {
      mensaje: 'Caja cerrada exitosamente (Corte Z)',
      resumen_cierre: cierre.resumen,
    };
  }
}
