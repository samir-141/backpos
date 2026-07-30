import {
  BadRequestException,
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

@Injectable()
export class CajasService {
  private readonly logger = new Logger(CajasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Resuelve un ID de usuario válido existente en la BD (fallback al primer usuario activo)
   */
  private async resolveUsuarioId(boticaId: string, usuarioId?: string): Promise<string> {
    if (usuarioId && usuarioId !== '00000000-0000-0000-0000-000000000000') {
      const u = await this.prisma.usuarios.findFirst({
        where: { id: usuarioId, botica_id: boticaId, deleted_at: null },
      });
      if (u) return u.id;
    }

    const primerUsuario = await this.prisma.usuarios.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });

    if (!primerUsuario) {
      throw new BadRequestException(
        'No existe ningún usuario activo registrado en el sistema.',
      );
    }

    return primerUsuario.id;
  }

  /**
   * Resuelve un ID de sucursal válido existente en la BD (fallback a la primera sucursal activa)
   */
  private async resolveSucursalId(
    boticaId: string,
    sucursalId?: string,
  ): Promise<string> {
    if (sucursalId) {
      const s = await this.prisma.sucursales.findFirst({
        where: { id: sucursalId, botica_id: boticaId, deleted_at: null },
      });
      if (s) return s.id;
    }

    const primeraSucursal = await this.prisma.sucursales.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
      orderBy: { created_at: 'asc' },
    });

    if (!primeraSucursal) {
      throw new BadRequestException(
        'No existe ninguna sucursal vigente para la botica actual. Crea una sucursal antes de operar cajas.',
      );
    }

    return primeraSucursal.id;
  }

  /**
   * Obtiene o crea la caja de la sucursal asegurando IDs válidos de Foreign Keys
   */
  private async getOrCreateCaja(sucursalIdReq?: string, usuarioIdReq?: string, boticaId?: string) {
    if (!boticaId) {
      throw new BadRequestException('No se pudo determinar la botica del usuario.');
    }

    const sucursalId = await this.resolveSucursalId(boticaId, sucursalIdReq);
    const usuarioId = await this.resolveUsuarioId(boticaId, usuarioIdReq);

    let caja = await this.prisma.cajas.findFirst({
      where: { sucursal_id: sucursalId, botica_id: boticaId, deleted_at: null },
    });

    if (!caja) {
      const sucursal = await this.prisma.sucursales.findUnique({
        where: { id: sucursalId },
      });

      caja = await this.prisma.cajas.create({
        data: {
          sucursal_id: sucursalId,
          botica_id: boticaId,
          nombre: `Caja Principal - ${sucursal?.nombre || 'POS'}`,
          estado: 'CERRADA',
          created_by: usuarioId,
        },
      });
    }

    return { caja, usuarioId, sucursalId };
  }

  /**
   * Obtiene el estado actual de la caja y sus métricas del turno
   */
  async getEstadoCaja(boticaId: string, usuarioIdReq?: string, sucursalIdReq?: string) {
    const { caja, usuarioId, sucursalId } = await this.getOrCreateCaja(
      sucursalIdReq,
      usuarioIdReq,
      boticaId,
    );

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

    // Obtener el último movimiento de APERTURA para delimitar el turno actual
    const ultimaApertura = await this.prisma.movimientos_caja.findFirst({
      where: {
        caja_id: caja.id,
        tipo: 'APERTURA',
        deleted_at: null,
      },
      orderBy: { fecha: 'desc' },
    });

    const fechaApertura = ultimaApertura?.fecha || new Date();
    const montoInicial = Number(ultimaApertura?.monto || 0);

    // Movimientos manuales en el turno actual (INGRESO / EGRESO)
    const movimientosTurno = await this.prisma.movimientos_caja.findMany({
      where: {
        caja_id: caja.id,
        fecha: { gte: fechaApertura },
        deleted_at: null,
      },
    });

    let ingresosManuales = 0;
    let egresosManuales = 0;

    movimientosTurno.forEach((m) => {
      if (m.tipo === 'INGRESO') ingresosManuales += Number(m.monto);
      if (m.tipo === 'EGRESO') egresosManuales += Number(m.monto);
    });

    // Ventas registradas desde la apertura del turno
    const ventasTurno = await this.prisma.ventas.findMany({
      where: {
        caja_id: caja.id,
        fecha: { gte: fechaApertura },
        deleted_at: null,
      },
      include: {
        pagos: {
          include: { metodos_pago: true },
        },
      },
    });

    let ventasEfectivo = 0;
    let ventasDigitales = 0;
    const metodosMap = new Map<string, number>();

    ventasTurno.forEach((v) => {
      v.pagos.forEach((p) => {
        const metodoNombre = (p.metodos_pago?.nombre || 'EFECTIVO').toUpperCase();
        const montoPago = Number(p.monto);

        metodosMap.set(
          metodoNombre,
          (metodosMap.get(metodoNombre) || 0) + montoPago,
        );

        if (metodoNombre.includes('EFECTIVO')) {
          ventasEfectivo += montoPago;
        } else {
          ventasDigitales += montoPago;
        }
      });
    });

    const desgloseMetodos = Array.from(metodosMap.entries()).map(
      ([metodo, monto]) => ({
        metodo,
        monto,
      }),
    );

    const efectivoEsperado =
      montoInicial + ventasEfectivo + ingresosManuales - egresosManuales;

    return {
      caja_id: caja.id,
      nombre: caja.nombre,
      estado: 'ABIERTA',
      monto_inicial: montoInicial,
      efectivo_esperado: efectivoEsperado,
      ventas_efectivo: ventasEfectivo,
      ventas_digitales: ventasDigitales,
      desglose_metodos: desgloseMetodos,
      ingresos_manuales: ingresosManuales,
      egresos_manuales: egresosManuales,
      operaciones_count: ventasTurno.length,
      fecha_apertura: fechaApertura.toISOString(),
    };
  }

  /**
   * Apertura de caja con monto inicial (sencillo)
   */
  async aperturarCaja(
    boticaId: string,
    usuarioIdReq?: string,
    sucursalIdReq?: string,
    dto?: AperturaCajaDto,
  ) {
    const sucursalTarget = dto?.sucursal_id || sucursalIdReq;
    const { caja, usuarioId } = await this.getOrCreateCaja(
      sucursalTarget,
      usuarioIdReq,
      boticaId,
    );

    if (caja.estado === 'ABIERTA') {
      throw new BadRequestException('La caja ya se encuentra ABIERTA.');
    }

    const montoInicial = dto?.monto_inicial ?? 0;

    // Actualizar estado a ABIERTA
    await this.prisma.cajas.update({
      where: { id: caja.id },
      data: {
        estado: 'ABIERTA',
        updated_by: usuarioId,
      },
    });

    // Registrar movimiento de apertura con usuarioId garantizado en la BD
    await this.prisma.movimientos_caja.create({
      data: {
        caja_id: caja.id,
        botica_id: boticaId,
        usuario_id: usuarioId,
        tipo: 'APERTURA',
        monto: montoInicial,
        observacion: dto?.observacion || 'Apertura de turno',
        created_by: usuarioId,
      },
    });

    // Realtime broadcast
    this.realtimeService.notificarCajaAperturada(
      caja.sucursal_id,
      caja.id,
      usuarioId,
      montoInicial,
    );

    return {
      mensaje: 'Caja aperturada exitosamente',
      caja_id: caja.id,
      monto_inicial: montoInicial,
    };
  }

  /**
   * Registrar movimiento manual (INGRESO / EGRESO)
   */
  async registrarMovimiento(
    boticaId: string,
    usuarioIdReq?: string,
    sucursalIdReq?: string,
    dto?: MovimientoCajaDto,
  ) {
    if (!dto) throw new BadRequestException('Datos de movimiento requeridos.');

    const sucursalTarget = dto.sucursal_id || sucursalIdReq;
    const { caja, usuarioId } = await this.getOrCreateCaja(
      sucursalTarget,
      usuarioIdReq,
      boticaId,
    );

    if (caja.estado !== 'ABIERTA') {
      throw new BadRequestException(
        'Debes aperturar la caja para registrar movimientos.',
      );
    }

    const movimiento = await this.prisma.movimientos_caja.create({
      data: {
        caja_id: caja.id,
        botica_id: boticaId,
        usuario_id: usuarioId,
        tipo: dto.tipo,
        monto: dto.monto,
        observacion: dto.observacion,
        created_by: usuarioId,
      },
    });

    return {
      mensaje: `Movimiento de ${dto.tipo} registrado correctamente`,
      movimiento,
    };
  }

  /**
   * Arqueo y Cierre de Caja (Corte Z)
   */
  async cerrarCaja(
    boticaId: string,
    usuarioIdReq?: string,
    sucursalIdReq?: string,
    dto?: CierreCajaDto,
  ) {
    const sucursalTarget = dto?.sucursal_id || sucursalIdReq;
    const { caja, usuarioId } = await this.getOrCreateCaja(
      sucursalTarget,
      usuarioIdReq,
      boticaId,
    );

    if (caja.estado !== 'ABIERTA') {
      throw new BadRequestException('La caja ya se encuentra CERRADA.');
    }

    const estadoAntes = await this.getEstadoCaja(
      boticaId,
      usuarioId,
      caja.sucursal_id,
    );
    const efectivoEsperado = estadoAntes.efectivo_esperado;
    const efectivoContado = dto?.efectivo_contado ?? 0;
    const diferencia = efectivoContado - efectivoEsperado;

    let tipoDiferencia = 'EXACTO';
    if (diferencia > 0) tipoDiferencia = 'SOBRANTE';
    if (diferencia < 0) tipoDiferencia = 'FALTANTE';

    const observacionCierre = `${dto?.observacion || 'Cierre de turno (Corte Z)'} | [${tipoDiferencia}: S/ ${Math.abs(diferencia).toFixed(2)}]`;

    // Registrar movimiento de cierre
    await this.prisma.movimientos_caja.create({
      data: {
        caja_id: caja.id,
        botica_id: boticaId,
        usuario_id: usuarioId,
        tipo: 'CIERRE',
        monto: efectivoContado,
        observacion: observacionCierre,
        created_by: usuarioId,
      },
    });

    // Actualizar estado a CERRADA
    await this.prisma.cajas.update({
      where: { id: caja.id },
      data: {
        estado: 'CERRADA',
        updated_by: usuarioId,
      },
    });

    const resumenFinal = {
      caja_id: caja.id,
      nombre_caja: caja.nombre,
      fecha_cierre: new Date().toISOString(),
      fecha_apertura: estadoAntes.fecha_apertura,
      monto_inicial: estadoAntes.monto_inicial,
      ventas_efectivo: estadoAntes.ventas_efectivo,
      ventas_digitales: estadoAntes.ventas_digitales,
      desglose_metodos: estadoAntes.desglose_metodos,
      ingresos_manuales: estadoAntes.ingresos_manuales,
      egresos_manuales: estadoAntes.egresos_manuales,
      efectivo_esperado: efectivoEsperado,
      efectivo_contado: efectivoContado,
      diferencia: diferencia,
      tipo_diferencia: tipoDiferencia,
      operaciones_count: estadoAntes.operaciones_count,
      observacion: dto?.observacion || 'Ninguna',
    };

    // Realtime broadcast
    this.realtimeService.notificarCajaCerrada(
      caja.sucursal_id,
      caja.id,
      resumenFinal,
    );

    return {
      mensaje: 'Caja cerrada exitosamente (Corte Z)',
      resumen_cierre: resumenFinal,
    };
  }
}
