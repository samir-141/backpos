import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCompraDetalleDto,
  CreateCompraDto,
  QueryComprasDto,
} from './dto/compras.dto';

type TransactionClient = Prisma.TransactionClient;

interface CompraContext {
  boticaId: string;
  usuarioId: string;
  sucursalId: string;
}

interface PresentacionCompra {
  id: string;
  cantidad_unidad_base: number;
  productos_comerciales: {
    id: string;
    controla_lote: boolean;
    requiere_vencimiento: boolean;
    medicamentos: { afecto_igv: boolean } | null;
  };
}

interface DetallePreparado {
  dto: CreateCompraDetalleDto;
  presentacion: PresentacionCompra;
  numeroLote: string;
  fechaFabricacion: Date | null;
  fechaVencimiento: Date | null;
  unidadesBase: number;
  costoPresentacion: Prisma.Decimal;
  costoUnidadBase: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  afectoIgv: boolean;
}

const COMPRA_INCLUDE = {
  proveedores: {
    select: { id: true, ruc: true, razon_social: true },
  },
  sucursales: {
    select: { id: true, nombre: true },
  },
  usuarios: {
    select: { id: true, nombre: true },
  },
  detalles_compras: {
    where: { deleted_at: null },
    include: {
      productos_presentaciones: {
        select: {
          id: true,
          cantidad_unidad_base: true,
          productos_comerciales: {
            select: { id: true, nombre_comercial: true, sku: true },
          },
          unidades_presentacion: {
            select: { id: true, nombre: true, abreviatura: true },
          },
        },
      },
      lotes: {
        where: { deleted_at: null },
        select: {
          id: true,
          numero_lote: true,
          fecha_fabricacion: true,
          fecha_vencimiento: true,
          stock_actual: true,
        },
      },
    },
  },
} satisfies Prisma.comprasInclude;

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    boticaId: string,
    usuarioId: string,
    sucursalSolicitada: string | undefined,
    dto: CreateCompraDto,
  ) {
    const serie = dto.serie.trim().toUpperCase();
    const numero = dto.numero.trim().toUpperCase();
    if (!serie || !numero) {
      throw new BadRequestException('La serie y el número son obligatorios.');
    }

    return this.transactionWithRetry(async (tx) => {
      const context = await this.resolveContext(
        tx,
        boticaId,
        usuarioId,
        sucursalSolicitada,
      );
      const invoiceKey = `${boticaId}:${dto.proveedor_id}:${serie}:${numero}`;
      await this.advisoryLock(tx, `compra:${invoiceKey}`);

      const existente = await tx.compras.findFirst({
        where: {
          botica_id: boticaId,
          proveedor_id: dto.proveedor_id,
          serie,
          numero,
          deleted_at: null,
        },
        include: COMPRA_INCLUDE,
      });
      if (existente) {
        if (existente.sucursal_id !== context.sucursalId) {
          throw new ConflictException(
            'Ese comprobante de compra ya fue registrado en otra sucursal.',
          );
        }
        return { ...this.serializeCompra(existente), idempotente: true };
      }

      const proveedor = await tx.proveedores.findFirst({
        where: {
          id: dto.proveedor_id,
          botica_id: boticaId,
          deleted_at: null,
        },
        select: { id: true, razon_social: true },
      });
      if (!proveedor) {
        throw new BadRequestException(
          'El proveedor no existe o pertenece a otra botica.',
        );
      }

      const detalles = await this.prepareDetails(tx, boticaId, dto.detalles);
      this.assertNoDuplicateDetails(detalles);
      const subtotal = detalles
        .reduce(
          (sum, detalle) => sum.add(detalle.subtotal),
          new Prisma.Decimal(0),
        )
        .toDecimalPlaces(2);
      const baseAfectaIgv = detalles
        .filter((detalle) => detalle.afectoIgv)
        .reduce(
          (sum, detalle) => sum.add(detalle.subtotal),
          new Prisma.Decimal(0),
        );
      const igv = baseAfectaIgv.mul('0.18').toDecimalPlaces(2);
      const total = subtotal.add(igv).toDecimalPlaces(2);

      await this.advisoryLock(tx, `tipo-movimiento:${boticaId}:COMPRA`);
      let tipoMovimiento = await tx.tipos_movimientos_inventario.findFirst({
        where: { botica_id: boticaId, codigo: 'COMPRA', deleted_at: null },
        select: { id: true },
      });
      if (!tipoMovimiento) {
        tipoMovimiento = await tx.tipos_movimientos_inventario.create({
          data: {
            botica_id: boticaId,
            codigo: 'COMPRA',
            descripcion: 'Ingreso de inventario por compra a proveedor',
            afecta_stock: 1,
            created_by: usuarioId,
          },
          select: { id: true },
        });
      }

      const lotLocks = [
        ...new Set(
          detalles.map(
            (detalle) =>
              `lote:${boticaId}:${context.sucursalId}:${detalle.presentacion.productos_comerciales.id}:${detalle.numeroLote}`,
          ),
        ),
      ].sort();
      for (const lock of lotLocks) await this.advisoryLock(tx, lock);

      const compra = await tx.compras.create({
        data: {
          botica_id: boticaId,
          proveedor_id: proveedor.id,
          usuario_id: usuarioId,
          sucursal_id: context.sucursalId,
          fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
          serie,
          numero,
          subtotal,
          igv,
          total,
          created_by: usuarioId,
        },
        select: { id: true },
      });

      for (const detalle of detalles) {
        await this.persistDetail(
          tx,
          context,
          compra.id,
          `${serie}-${numero}`,
          tipoMovimiento.id,
          detalle,
        );
      }

      await tx.gastos_operativos.create({
        data: {
          botica_id: boticaId,
          sucursal_id: context.sucursalId,
          tipo: 'INVERSION',
          categoria: 'COMPRA_INVENTARIO',
          descripcion: `Compra de inventario a ${proveedor.razon_social}`,
          monto: total,
          fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
          comprobante: `${serie}-${numero}`,
        },
      });

      const creada = await tx.compras.findFirst({
        where: { id: compra.id, botica_id: boticaId, deleted_at: null },
        include: COMPRA_INCLUDE,
      });
      if (!creada) {
        throw new Error('No se pudo recuperar la compra recién creada.');
      }
      return { ...this.serializeCompra(creada), idempotente: false };
    });
  }

  async findAll(
    boticaId: string,
    usuarioId: string,
    sucursalSolicitada: string | undefined,
    query: QueryComprasDto,
  ) {
    const context = await this.resolveContext(
      this.prisma,
      boticaId,
      usuarioId,
      sucursalSolicitada,
    );
    const page = query.page || 1;
    const limit = query.limit || 20;
    const buscar = query.buscar?.trim();
    const fecha = this.buildDateFilter(query.desde, query.hasta);
    const where: Prisma.comprasWhereInput = {
      botica_id: boticaId,
      sucursal_id: context.sucursalId,
      deleted_at: null,
      ...(query.proveedor_id ? { proveedor_id: query.proveedor_id } : {}),
      ...(fecha ? { fecha } : {}),
      ...(buscar
        ? {
            OR: [
              { serie: { contains: buscar, mode: 'insensitive' } },
              { numero: { contains: buscar, mode: 'insensitive' } },
              {
                proveedores: {
                  razon_social: { contains: buscar, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.compras.findMany({
        where,
        include: {
          proveedores: { select: { id: true, ruc: true, razon_social: true } },
          sucursales: { select: { id: true, nombre: true } },
          _count: { select: { detalles_compras: true } },
        },
        orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.compras.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.serializeCompra(row)),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(boticaId: string, usuarioId: string, id: string) {
    const compra = await this.prisma.compras.findFirst({
      where: { id, botica_id: boticaId, deleted_at: null },
      include: COMPRA_INCLUDE,
    });
    if (!compra) throw new NotFoundException('Compra no encontrada.');
    await this.resolveContext(
      this.prisma,
      boticaId,
      usuarioId,
      compra.sucursal_id,
    );
    return this.serializeCompra(compra);
  }

  private async resolveContext(
    client: PrismaService | TransactionClient,
    boticaId: string,
    usuarioId: string,
    sucursalSolicitada?: string,
  ): Promise<CompraContext> {
    const usuario = await client.usuarios.findFirst({
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
    const asignacion = await client.usuario_sucursales.findFirst({
      where: {
        usuario_id: usuarioId,
        botica_id: boticaId,
        activo: true,
        ...(sucursalSolicitada ? { sucursal_id: sucursalSolicitada } : {}),
        sucursales: { botica_id: boticaId, deleted_at: null },
      },
      orderBy: [{ es_principal: 'desc' }, { created_at: 'asc' }],
      select: { sucursal_id: true },
    });
    if (!asignacion) {
      throw new ForbiddenException(
        sucursalSolicitada
          ? 'La sucursal no está asignada al usuario autenticado.'
          : 'El usuario no tiene una sucursal activa asignada.',
      );
    }
    return { boticaId, usuarioId, sucursalId: asignacion.sucursal_id };
  }

  private async prepareDetails(
    tx: TransactionClient,
    boticaId: string,
    detalles: CreateCompraDetalleDto[],
  ): Promise<DetallePreparado[]> {
    const ids = [
      ...new Set(detalles.map((item) => item.producto_presentacion_id)),
    ];
    const presentaciones = await tx.productos_presentaciones.findMany({
      where: {
        id: { in: ids },
        botica_id: boticaId,
        deleted_at: null,
        productos_comerciales: {
          botica_id: boticaId,
          estado: 'ACTIVO',
          deleted_at: null,
        },
      },
      select: {
        id: true,
        cantidad_unidad_base: true,
        productos_comerciales: {
          select: {
            id: true,
            controla_lote: true,
            requiere_vencimiento: true,
            medicamentos: { select: { afecto_igv: true } },
          },
        },
      },
    });
    const byId = new Map(
      presentaciones.map((presentacion) => [presentacion.id, presentacion]),
    );
    const today = this.todayInLima();

    return detalles.map((item) => {
      const presentacion = byId.get(item.producto_presentacion_id);
      if (!presentacion) {
        throw new BadRequestException(
          `La presentación ${item.producto_presentacion_id} no existe, está inactiva o pertenece a otra botica.`,
        );
      }
      const producto = presentacion.productos_comerciales;
      const numeroLote = producto.controla_lote
        ? item.numero_lote?.trim().toUpperCase()
        : item.numero_lote?.trim().toUpperCase() || 'SIN-LOTE';
      if (!numeroLote) {
        throw new BadRequestException(
          `El lote es obligatorio para la presentación ${presentacion.id}.`,
        );
      }
      const fechaFabricacion = this.parseDateOnly(item.fecha_fabricacion);
      const fechaVencimiento = this.parseDateOnly(item.fecha_vencimiento);
      if (producto.requiere_vencimiento && !fechaVencimiento) {
        throw new BadRequestException(
          `La fecha de vencimiento es obligatoria para la presentación ${presentacion.id}.`,
        );
      }
      if (
        item.fecha_vencimiento &&
        item.fecha_vencimiento.slice(0, 10) < today
      ) {
        throw new BadRequestException('No se puede ingresar un lote vencido.');
      }
      if (
        item.fecha_fabricacion &&
        item.fecha_fabricacion.slice(0, 10) > today
      ) {
        throw new BadRequestException(
          'La fecha de fabricación no puede estar en el futuro.',
        );
      }
      if (
        item.fecha_fabricacion &&
        item.fecha_vencimiento &&
        item.fecha_fabricacion.slice(0, 10) >
          item.fecha_vencimiento.slice(0, 10)
      ) {
        throw new BadRequestException(
          'La fabricación no puede ser posterior al vencimiento.',
        );
      }
      const unidadesBase = item.cantidad * presentacion.cantidad_unidad_base;
      if (!Number.isSafeInteger(unidadesBase) || unidadesBase > 2_147_483_647) {
        throw new BadRequestException(
          'La cantidad convertida a unidades base excede el límite permitido.',
        );
      }
      const costoPresentacion = new Prisma.Decimal(
        item.costo_unitario.toString(),
      );
      return {
        dto: item,
        presentacion,
        numeroLote,
        fechaFabricacion,
        fechaVencimiento,
        unidadesBase,
        costoPresentacion,
        costoUnidadBase: costoPresentacion
          .div(presentacion.cantidad_unidad_base)
          .toDecimalPlaces(4),
        subtotal: costoPresentacion.mul(item.cantidad),
        afectoIgv: producto.medicamentos?.afecto_igv ?? true,
      };
    });
  }

  private assertNoDuplicateDetails(detalles: DetallePreparado[]): void {
    const seen = new Set<string>();
    for (const detalle of detalles) {
      const key = `${detalle.presentacion.id}:${detalle.numeroLote}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          'No repita la misma presentación y lote; consolide la cantidad.',
        );
      }
      seen.add(key);
    }
  }

  private async persistDetail(
    tx: TransactionClient,
    context: CompraContext,
    compraId: string,
    comprobante: string,
    tipoMovimientoId: string,
    detalle: DetallePreparado,
  ): Promise<void> {
    const productoId = detalle.presentacion.productos_comerciales.id;
    const existente = await tx.lotes.findFirst({
      where: {
        botica_id: context.boticaId,
        sucursal_id: context.sucursalId,
        producto_comercial_id: productoId,
        numero_lote: detalle.numeroLote,
        deleted_at: null,
      },
    });

    const detalleCompra = await tx.detalles_compras.create({
      data: {
        botica_id: context.boticaId,
        compra_id: compraId,
        producto_presentacion_id: detalle.presentacion.id,
        cantidad: detalle.dto.cantidad,
        precio_unitario: detalle.costoPresentacion,
        created_by: context.usuarioId,
        lote_id: existente ? existente.id : undefined,
      },
      select: { id: true },
    });

    let lote: { id: string; stock_actual: number };
    let stockAnterior = 0;
    if (existente) {
      this.assertCompatibleLot(existente, detalle);
      stockAnterior = existente.stock_actual;
      const stockNuevo = stockAnterior + detalle.unidadesBase;
      const costoPromedio = new Prisma.Decimal(
        existente.precio_compra_unidad_base,
      )
        .mul(stockAnterior)
        .add(detalle.costoUnidadBase.mul(detalle.unidadesBase))
        .div(stockNuevo)
        .toDecimalPlaces(4);
      lote = await tx.lotes.update({
        where: { id: existente.id },
        data: {
          stock_actual: { increment: detalle.unidadesBase },
          precio_compra_unidad_base: costoPromedio,
          updated_by: context.usuarioId,
          updated_at: new Date(),
        },
        select: { id: true, stock_actual: true },
      });
    } else {
      lote = await tx.lotes.create({
        data: {
          botica_id: context.boticaId,
          sucursal_id: context.sucursalId,
          producto_comercial_id: productoId,
          detalle_compra_id: detalleCompra.id,
          numero_lote: detalle.numeroLote,
          fecha_fabricacion: detalle.fechaFabricacion,
          fecha_vencimiento: detalle.fechaVencimiento,
          precio_compra_unidad_base: detalle.costoUnidadBase,
          stock_actual: detalle.unidadesBase,
          created_by: context.usuarioId,
        },
        select: { id: true, stock_actual: true },
      });

      await tx.detalles_compras.update({
        where: { id: detalleCompra.id },
        data: { lote_id: lote.id },
      });
    }

    await tx.movimientos_inventario.create({
      data: {
        botica_id: context.boticaId,
        lote_id: lote.id,
        tipo_movimiento_id: tipoMovimientoId,
        usuario_id: context.usuarioId,
        cantidad: detalle.unidadesBase,
        stock_anterior: stockAnterior,
        stock_nuevo: lote.stock_actual,
        documento_referencia: comprobante,
        observacion: `Compra ${comprobante}; ${detalle.dto.cantidad} presentación(es), lote ${detalle.numeroLote}`,
        created_by: context.usuarioId,
      },
    });
  }

  private assertCompatibleLot(
    existente: {
      numero_lote: string;
      fecha_fabricacion: Date | null;
      fecha_vencimiento: Date | null;
    },
    detalle: DetallePreparado,
  ): void {
    if (
      this.dateKey(existente.fecha_fabricacion) !==
        this.dateKey(detalle.fechaFabricacion) ||
      this.dateKey(existente.fecha_vencimiento) !==
        this.dateKey(detalle.fechaVencimiento)
    ) {
      throw new ConflictException(
        `El lote ${existente.numero_lote} ya existe con fechas diferentes.`,
      );
    }
  }

  private async advisoryLock(
    tx: TransactionClient,
    key: string,
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      key,
    );
  }

  private async transactionWithRetry<T>(
    operation: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.isRetryable(error) || attempt === 2) throw error;
      }
    }
    throw new ConflictException('No se pudo completar la compra concurrente.');
  }

  private isRetryable(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'P2034' || error.code === 'P2002')
    );
  }

  private buildDateFilter(desde?: string, hasta?: string) {
    if (!desde && !hasta) return undefined;
    if (desde && hasta && desde.slice(0, 10) > hasta.slice(0, 10)) {
      throw new BadRequestException('La fecha desde no puede superar a hasta.');
    }
    return {
      ...(desde
        ? { gte: new Date(`${desde.slice(0, 10)}T00:00:00.000Z`) }
        : {}),
      ...(hasta
        ? { lte: new Date(`${hasta.slice(0, 10)}T23:59:59.999Z`) }
        : {}),
    };
  }

  private parseDateOnly(value?: string): Date | null {
    return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
  }

  private todayInLima(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private dateKey(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private serializeCompra<T extends Record<string, unknown>>(compra: T) {
    return {
      ...compra,
      subtotal: Number(compra.subtotal || 0),
      igv: Number(compra.igv || 0),
      total: Number(compra.total || 0),
      ...(Array.isArray(compra.detalles_compras)
        ? {
            detalles_compras: compra.detalles_compras.map((detalle) => {
              const item = detalle as Record<string, unknown>;
              return {
                ...item,
                precio_unitario: Number(item.precio_unitario || 0),
              };
            }),
          }
        : {}),
    };
  }
}
