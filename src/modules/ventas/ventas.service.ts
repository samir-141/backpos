import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../../socket/events.gateway';

@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private async resolveUsuarioId(
    tx: any,
    boticaId: string,
    usuarioId?: string,
  ): Promise<string> {
    if (usuarioId && usuarioId !== '00000000-0000-0000-0000-000000000000') {
      const u = await tx.usuarios.findFirst({
        where: { id: usuarioId, botica_id: boticaId, deleted_at: null },
      });
      if (u) return u.id;
    }

    const primerUsuario = await tx.usuarios.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });
    if (!primerUsuario) {
      throw new BadRequestException('No existe ningún usuario registrado en el sistema.');
    }
    return primerUsuario.id;
  }

  private async resolveSucursalId(
    tx: any,
    boticaId: string,
    sucursalId?: string,
  ): Promise<string> {
    if (sucursalId && sucursalId !== '00000000-0000-0000-0000-000000000000') {
      const s = await tx.sucursales.findFirst({
        where: { id: sucursalId, botica_id: boticaId, deleted_at: null },
      });
      if (s) return s.id;
    }

    const primeraSucursal = await tx.sucursales.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });
    if (!primeraSucursal) {
      throw new BadRequestException('No existe ninguna sucursal registrada en el sistema.');
    }
    return primeraSucursal.id;
  }

  async create(dto: CreateVentaDto, boticaId: string, sucursalId?: string, usuarioId?: string) {
    const metodoPagoNombre = String(dto.metodo_pago || 'EFECTIVO')
      .trim()
      .toUpperCase();
    this.logger.log(
      `Registrando venta por total S/ ${dto.total} - Comprobante: ${dto.tipo_comprobante} - Método: ${metodoPagoNombre}`,
    );

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'La venta debe incluir al menos un producto.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Resolver Sucursal y Usuario válidos en la BD
      const finalUsuarioId = await this.resolveUsuarioId(tx, boticaId, usuarioId);
      const finalSucursalId = await this.resolveSucursalId(tx, boticaId, sucursalId);

      // 2. Obtener o verificar Caja activa para la sucursal
      let caja = await tx.cajas.findFirst({
        where: { sucursal_id: finalSucursalId, botica_id: boticaId, deleted_at: null },
      });

      if (!caja) {
        const sucursal = await tx.sucursales.findUnique({ where: { id: finalSucursalId } });
        caja = await tx.cajas.create({
          data: {
            sucursal_id: finalSucursalId,
            botica_id: boticaId,
            nombre: `Caja Principal - ${sucursal?.nombre || 'POS'}`,
            estado: 'CERRADA',
            created_by: finalUsuarioId,
          },
        });
      }

      if (caja.estado === 'CERRADA') {
        throw new BadRequestException(
          'La caja se encuentra CERRADA. Por favor realiza la Apertura de Caja antes de cobrar ventas.',
        );
      }

      // 3. Obtener o crear Cliente si se proveyó
      let clienteId: string | null = null;
      if (dto.datos_cliente && dto.datos_cliente.numero_documento) {
        let cliente = await tx.clientes.findFirst({
          where: {
            numero_documento: dto.datos_cliente.numero_documento,
            botica_id: boticaId,
            deleted_at: null,
          },
        });

        if (!cliente) {
          cliente = await tx.clientes.create({
          data: {
            botica_id: boticaId,
            tipo_documento: dto.datos_cliente.tipo_documento || 'DNI',
              numero_documento: dto.datos_cliente.numero_documento,
              nombre: dto.datos_cliente.nombre_razon_social || 'CLIENTE POS',
              direccion: dto.datos_cliente.direccion || null,
              created_by: finalUsuarioId,
            },
          });
        }

        clienteId = cliente.id;
      }

      // 4. Crear la cabecera de la Venta
      const venta = await tx.ventas.create({
        data: {
          botica_id: boticaId,
          cliente_id: clienteId,
          usuario_id: finalUsuarioId,
          caja_id: caja.id,
          subtotal: dto.subtotal,
          descuento: 0,
          igv: dto.igv,
          total: dto.total,
          estado: 'EMITIDO',
          created_by: finalUsuarioId,
        },
      });

      // 5. Procesar los Detalles de la Venta y Descontar Stock FEFO Multilote
      for (const item of dto.items) {
        // A. Obtener presentación del producto coincidente con la selección del usuario
        let presentacion = null;
        if ((item as any).producto_presentacion_id) {
          presentacion = await tx.productos_presentaciones.findFirst({
            where: {
              id: (item as any).producto_presentacion_id,
              producto_comercial_id: item.producto_comercial_id,
              botica_id: boticaId,
              deleted_at: null,
            },
          });
        }

        if (!presentacion && item.presentacion_nombre) {
          presentacion = await tx.productos_presentaciones.findFirst({
            where: {
              producto_comercial_id: item.producto_comercial_id,
              botica_id: boticaId,
              unidades_presentacion: {
                nombre: { equals: item.presentacion_nombre, mode: 'insensitive' },
              },
              deleted_at: null,
            },
          });
        }

        if (!presentacion) {
          throw new BadRequestException(
            `La presentación seleccionada no existe o no pertenece al producto ${item.producto_comercial_id}. Configúrala antes de vender.`,
          );
        }

        const equivBase = Number(
          (item as any).unidades_base_por_pack ||
            presentacion.cantidad_unidad_base ||
            1,
        );
        let unidadesPendientes = item.cantidad * equivBase;

        // Obtener todos los lotes disponibles ordenados por vencimiento (FEFO) para la sucursal
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const lotesDisponibles = await tx.lotes.findMany({
          where: {
            producto_comercial_id: item.producto_comercial_id,
            sucursal_id: finalSucursalId,
              deleted_at: null,
              stock_actual: { gt: 0 },
              fecha_vencimiento: { gte: hoy },
          },
          orderBy: [{ fecha_vencimiento: 'asc' }, { stock_actual: 'desc' }],
        });

        if (lotesDisponibles.length === 0)
          throw new BadRequestException(
            `Stock insuficiente para el producto ${item.producto_comercial_id}. No hay lotes con stock disponible.`,
          );

        // Consumir lotes de forma iterativa según fecha de vencimiento FEFO
        for (const lote of lotesDisponibles) {
          if (unidadesPendientes <= 0) break;

          const descontar =
            lote.stock_actual > 0
              ? Math.min(lote.stock_actual, unidadesPendientes)
              : unidadesPendientes; // Si es el único lote, descontar completamente

          unidadesPendientes -= descontar;
          const nuevoStock = lote.stock_actual - descontar;
          const descuentoAtomico = await tx.lotes.updateMany({
            where: {
              id: lote.id,
              deleted_at: null,
              stock_actual: { gte: descontar },
            },
            data: {
              stock_actual: { decrement: descontar },
            },
          });
          if (descuentoAtomico.count !== 1) {
            throw new BadRequestException(
              `El stock cambió mientras se procesaba la venta del lote ${lote.numero_lote}. Vuelve a intentar.`,
            );
          }

          // Registrar movimiento de inventario para histórico y proyección
          const tipoMovVenta = await tx.tipos_movimientos_inventario.findFirst({
            where: { codigo: 'VENTA', deleted_at: null },
          });
          if (tipoMovVenta) {
            await tx.movimientos_inventario.create({
              data: {
                botica_id: boticaId,
                lote_id: lote.id,
                tipo_movimiento_id: tipoMovVenta.id,
                usuario_id: finalUsuarioId,
                cantidad: descontar,
                stock_anterior: lote.stock_actual,
                stock_nuevo: nuevoStock,
                documento_referencia: venta.id,
                observacion: `Venta ${venta.id} - Producto ${item.producto_comercial_id} - Lote ${lote.numero_lote}`,
                created_by: finalUsuarioId,
              },
            });
          }

          const cantPresentacion = Math.max(
            1,
            Math.round(descontar / equivBase),
          );
          const subtotalCalculado = Number(
            (item.precio_unitario * cantPresentacion).toFixed(2),
          );

          await tx.detalles_ventas.create({
            data: {
              botica_id: boticaId,
              venta_id: venta.id,
              producto_presentacion_id: presentacion.id,
              lote_id: lote.id,
              cantidad: cantPresentacion,
              precio_unitario_presentacion: item.precio_unitario,
              costo_unitario_base: lote.precio_compra_unidad_base,
              descuento: 0,
              subtotal: subtotalCalculado,
              created_by: finalUsuarioId,
            },
          });
        }

        if (unidadesPendientes > 0) {
          throw new BadRequestException(
            `Stock insuficiente para el producto ${item.producto_comercial_id}. Faltan ${unidadesPendientes} unidades base.`,
          );
        }
      }

      // 6. Obtener o crear el Método de Pago exacto (EFECTIVO, TARJETA, YAPE_PLIN, TRANSFERENCIA)
      let metodoPago = await tx.metodos_pago.findFirst({
        where: {
          nombre: { equals: metodoPagoNombre, mode: 'insensitive' },
          deleted_at: null,
        },
      });

      if (!metodoPago) {
        metodoPago = await tx.metodos_pago.create({
          data: {
            botica_id: boticaId,
            nombre: metodoPagoNombre,
            requiere_referencia: metodoPagoNombre !== 'EFECTIVO',
            created_by: finalUsuarioId,
          },
        });
      }

      // 7. Registrar el Pago con la referencia y el método exacto
      await tx.pagos.create({
        data: {
          botica_id: boticaId,
          venta_id: venta.id,
          metodo_pago_id: metodoPago.id,
          monto: dto.total,
          referencia: metodoPagoNombre,
          created_by: finalUsuarioId,
        },
      });

      // Audit Log (Sección 23 Documento 02)
      await this.auditService.registrar({
        usuario_id: finalUsuarioId,
        accion: 'VENTA_CREADA',
        tabla: 'ventas',
        observacion: `Venta registrada por S/ ${dto.total} - ${dto.tipo_comprobante} (${metodoPagoNombre})`,
      });

      // WebSocket Real-time Event (Sección 22 Documento 02)
      this.eventsGateway.emitirEvento('venta.creada', {
        venta_id: venta.id,
        total: dto.total,
      });
      this.eventsGateway.emitirEvento('stock.actualizado', {
        sucursal_id: finalSucursalId,
      });

      return {
        exito: true,
        mensaje: 'Venta registrada correctamente',
        venta_id: venta.id,
        total: dto.total,
        tipo_comprobante: dto.tipo_comprobante,
        metodo_pago: metodoPagoNombre,
      };
    });
  }

  async anular(id: string, boticaId: string, usuarioId?: string) {
    this.logger.log(`Anulando venta con ID: ${id}`);

    const res = await this.prisma.$transaction(async (tx) => {
      const venta = await tx.ventas.findFirst({
        where: { id, deleted_at: null, botica_id: boticaId },
        include: { detalles_ventas: true },
      });

      if (!venta) {
        throw new NotFoundException(`Venta con ID ${id} no encontrada`);
      }

      if (venta.estado === 'ANULADO') {
        throw new BadRequestException(
          `La venta ${id} ya fue anulada anteriormente.`,
        );
      }

      // 1. Marcar venta como ANULADO
      await tx.ventas.update({
        where: { id: venta.id },
        data: {
          estado: 'ANULADO',
          updated_at: new Date(),
          updated_by: usuarioId,
        },
      });

      // 2. Reponer stock a los lotes consumidos
      for (const detalle of venta.detalles_ventas) {
        if (detalle.lote_id && detalle.cantidad > 0) {
          const presentacion = await tx.productos_presentaciones.findFirst({
            where: { id: detalle.producto_presentacion_id },
          });
          const equiv = Number(presentacion?.cantidad_unidad_base || 1);
          const unidadesAReponer = detalle.cantidad * equiv;

          const lote = await tx.lotes.findFirst({
            where: { id: detalle.lote_id },
          });

          if (lote) {
            await tx.lotes.update({
              where: { id: lote.id },
              data: {
                stock_actual: lote.stock_actual + unidadesAReponer,
              },
            });
          }
        }
      }

      return {
        exito: true,
        mensaje: `Venta ${id} anulada exitosamente y stock repuesto en el inventario.`,
        venta_id: venta.id,
      };
    });

    // Audit Log & Event
    await this.auditService.registrar({
      usuario_id: usuarioId,
      accion: 'VENTA_ANULADA',
      tabla: 'ventas',
      observacion: `Venta ${id} anulada exitosamente.`,
    });
    this.eventsGateway.emitirEvento('venta.anulada', { venta_id: id });
    this.eventsGateway.emitirEvento('stock.actualizado', { venta_id: id });

    return res;
  }

  async findAll(boticaId: string, sucursalId?: string) {
    const where: any = { deleted_at: null, botica_id: boticaId };
    if (sucursalId) {
      where.cajas = { sucursal_id: sucursalId };
    }

    return await this.prisma.ventas.findMany({
      where,
      include: {
        detalles_ventas: true,
        pagos: {
          include: { metodos_pago: true },
        },
        clientes: true,
      },
      orderBy: { fecha: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string, boticaId: string) {
    const venta = await this.prisma.ventas.findFirst({
      where: { id, deleted_at: null, botica_id: boticaId },
      include: {
        detalles_ventas: {
          include: {
            lotes: true,
            productos_presentaciones: {
              include: {
                productos_comerciales: true,
              },
            },
          },
        },
        pagos: {
          include: { metodos_pago: true },
        },
        clientes: true,
      },
    });

    if (!venta) {
      throw new NotFoundException(`Venta con ID ${id} no encontrada`);
    }

    return venta;
  }

  async getStockHistory(
    boticaId: string,
    productoComercialId: string,
    sucursalId?: string,
  ) {
    const whereMov: any = {
      deleted_at: null,
      botica_id: boticaId,
      lote: {
        producto_comercial_id: productoComercialId,
      },
    };
    if (sucursalId) {
      whereMov.lote.sucursal_id = sucursalId;
    }

    const movimientos = await this.prisma.movimientos_inventario.findMany({
      where: whereMov,
      include: {
        lote: {
          select: { numero_lote: true, stock_actual: true },
        },
        tipo_movimiento: {
          select: { codigo: true, nombre: true },
        },
        usuario: {
          select: { nombre: true },
        },
      },
      orderBy: { fecha: 'desc' },
      take: 100,
    });

    return movimientos;
  }

  async proyeccionStock(
    boticaId: string,
    productoComercialId: string,
    sucursalId?: string,
    diasProyeccion = 30,
  ) {
    const whereMov: any = {
      deleted_at: null,
      botica_id: boticaId,
      lote: {
        producto_comercial_id: productoComercialId,
      },
    };
    if (sucursalId) {
      whereMov.lote.sucursal_id = sucursalId;
    }

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasProyeccion);

    const movimientos = await this.prisma.movimientos_inventario.findMany({
      where: {
        ...whereMov,
        fecha: { gte: fechaLimite },
        tipo_movimiento: { codigo: 'VENTA' },
      },
      select: { cantidad: true, fecha: true },
      orderBy: { fecha: 'asc' },
    });

    const ventasTotales = movimientos.reduce((sum, m) => sum + m.cantidad, 0);
    const ventasPorDia = ventasTotales / diasProyeccion;

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const loteActivo = await this.prisma.lotes.findFirst({
      where: {
        botica_id: boticaId,
        producto_comercial_id: productoComercialId,
        sucursal_id: sucursalId || { not: null },
          deleted_at: null,
          stock_actual: { gt: 0 },
          fecha_vencimiento: { gte: hoy },
      },
      orderBy: { fecha_vencimiento: 'asc' },
      select: { stock_actual: true, fecha_vencimiento: true },
    });

    const stockActual = loteActivo?.stock_actual ?? 0;
    const diasStockRestante =
      ventasPorDia > 0 ? Math.floor(stockActual / ventasPorDia) : null;
    const fechaProximoAgotamiento =
      diasStockRestante !== null
        ? new Date(Date.now() + diasStockRestante * 24 * 60 * 60 * 1000)
        : null;

    return {
      producto_comercial_id: productoComercialId,
      stock_actual: stockActual,
      ventas_ultimos_dias: ventasTotales,
      ventas_por_dia: Number(ventasPorDia.toFixed(2)),
      periodo_proyeccion_dias: diasProyeccion,
      dias_stock_restante: diasStockRestante,
      fecha_proximo_agotamiento: fechaProximoAgotamiento,
      precaucion:
        diasStockRestante !== null
          ? diasStockRestante <= 7
            ? 'CRÍTICO: Menos de 7 días de stock'
            : diasStockRestante <= 14
              ? 'ALERTA: Menos de 14 días de stock'
              : 'Stock adecuado'
          : 'Sin datos suficientes para proyección',
    };
  }
}
