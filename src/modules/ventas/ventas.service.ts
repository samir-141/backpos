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
import { randomBytes, randomUUID } from 'crypto';
import { hashSnapshot } from '../comprobantes-publicos/comprobantes-publicos.service';

@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private fromCents(cents: number): number {
    return Number((cents / 100).toFixed(2));
  }

  private toCents(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException(
        'El precio configurado para la presentación no es válido.',
      );
    }
    return Math.round(amount * 100);
  }

  private isIdempotencyConflict(error: unknown): boolean {
    const candidate = error as {
      code?: string;
      meta?: { target?: string | string[]; constraint?: string };
    };
    if (candidate?.code !== 'P2002') return false;
    const target = Array.isArray(candidate.meta?.target)
      ? candidate.meta?.target.join(',')
      : String(candidate.meta?.target || candidate.meta?.constraint || '');
    return (
      target.includes('idempotency_key') ||
      target.includes('uq_ventas_botica_idempotency_key')
    );
  }

  private async findVentaIdempotente(
    db: any,
    boticaId: string,
    idempotencyKey: string,
  ): Promise<any | null> {
    const venta = await db.ventas.findFirst({
      where: {
        botica_id: boticaId,
        idempotency_key: idempotencyKey,
      },
      include: {
        pagos: {
          where: { deleted_at: null },
          include: { metodos_pago: true },
          take: 1,
        },
      },
    });
    if (!venta) return null;

    const comprobante = await db.comprobantes_publicos.findFirst({
      where: { venta_id: venta.id, botica_id: boticaId },
      select: { token_publico: true, snapshot: true },
    });
    const snapshot = (comprobante?.snapshot || {}) as Record<string, any>;
    const metodoPago =
      venta.pagos?.[0]?.metodos_pago?.nombre ||
      snapshot.metodo_pago ||
      'EFECTIVO';
    return {
      exito: true,
      idempotente: true,
      mensaje:
        'La venta ya había sido registrada; se devuelve el resultado original.',
      venta_id: venta.id,
      idempotency_key: idempotencyKey,
      estado: venta.estado,
      subtotal: Number(venta.subtotal),
      igv: Number(venta.igv),
      total: Number(venta.total),
      tipo_comprobante: snapshot.tipo_comprobante || 'COMPROBANTE',
      metodo_pago: metodoPago,
      comprobante_token: comprobante?.token_publico || null,
      comprobante_url: comprobante?.token_publico
        ? `/c/${comprobante.token_publico}`
        : null,
    };
  }

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
      throw new BadRequestException(
        'No existe ningún usuario registrado en el sistema.',
      );
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
      throw new BadRequestException(
        'No existe ninguna sucursal registrada en el sistema.',
      );
    }
    return primeraSucursal.id;
  }

  async create(
    dto: CreateVentaDto,
    boticaId: string,
    sucursalId?: string,
    usuarioId?: string,
  ) {
    const metodoPagoNombre = String(dto.metodo_pago || 'EFECTIVO')
      .trim()
      .toUpperCase();
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'La venta debe incluir al menos un producto.',
      );
    }

    const idempotencyKey = dto.idempotency_key || randomUUID();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const ventaExistente = await this.findVentaIdempotente(
          tx,
          boticaId,
          idempotencyKey,
        );
        if (ventaExistente) return ventaExistente;

        // 1. Resolver Sucursal y Usuario válidos en la BD
        const finalUsuarioId = await this.resolveUsuarioId(
          tx,
          boticaId,
          usuarioId,
        );
        const finalSucursalId = await this.resolveSucursalId(
          tx,
          boticaId,
          sucursalId,
        );

        // 2. Obtener o verificar Caja activa para la sucursal
        let caja = await tx.cajas.findFirst({
          where: {
            sucursal_id: finalSucursalId,
            botica_id: boticaId,
            deleted_at: null,
          },
        });

        if (!caja) {
          const sucursal = await tx.sucursales.findUnique({
            where: { id: finalSucursalId },
          });
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
        let cliente: any = null;
        if (dto.datos_cliente && dto.datos_cliente.numero_documento) {
          cliente = await tx.clientes.findFirst({
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

        // 4. Resolver presentaciones y calcular importes exclusivamente con datos de BD.
        const itemsCalculados: Array<{
          item: CreateVentaDto['items'][number];
          presentacion: any;
          producto: any;
          cantidad: number;
          equivBase: number;
          precioUnitarioCents: number;
          totalLineaCents: number;
        }> = [];
        let subtotalCents = 0;
        let igvCents = 0;
        let totalCents = 0;

        for (const item of dto.items) {
          if (!item.producto_presentacion_id) {
            throw new BadRequestException(
              `Debes seleccionar una presentación válida para el producto ${item.producto_comercial_id}.`,
            );
          }
          if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
            throw new BadRequestException(
              'La cantidad de cada producto debe ser un entero mayor a cero.',
            );
          }

          const presentacion = await tx.productos_presentaciones.findFirst({
            where: {
              id: item.producto_presentacion_id,
              producto_comercial_id: item.producto_comercial_id,
              botica_id: boticaId,
              deleted_at: null,
            },
            include: {
              productos_comerciales: {
                select: {
                  id: true,
                  estado: true,
                  requiere_vencimiento: true,
                  medicamentos: { select: { afecto_igv: true } },
                },
              },
            },
          });

          if (
            !presentacion ||
            presentacion.productos_comerciales?.estado !== 'ACTIVO'
          ) {
            throw new BadRequestException(
              `La presentación seleccionada no existe, está inactiva o no pertenece al producto ${item.producto_comercial_id}.`,
            );
          }

          const equivBase = Number(presentacion.cantidad_unidad_base);
          if (!Number.isInteger(equivBase) || equivBase <= 0) {
            throw new BadRequestException(
              'La equivalencia de la presentación no es válida.',
            );
          }

          const precioUnitarioCents = this.toCents(presentacion.precio_actual);
          if (precioUnitarioCents <= 0) {
            throw new BadRequestException(
              'La presentación debe tener un precio de venta mayor a cero.',
            );
          }

          const totalLineaCents = precioUnitarioCents * item.cantidad;
          const afectoIgv =
            presentacion.productos_comerciales.medicamentos?.afecto_igv ?? true;
          const subtotalLineaCents = afectoIgv
            ? Math.round(totalLineaCents / 1.18)
            : totalLineaCents;
          subtotalCents += subtotalLineaCents;
          igvCents += totalLineaCents - subtotalLineaCents;
          totalCents += totalLineaCents;
          itemsCalculados.push({
            item,
            presentacion,
            producto: presentacion.productos_comerciales,
            cantidad: item.cantidad,
            equivBase,
            precioUnitarioCents,
            totalLineaCents,
          });
        }

        const subtotalCalculado = this.fromCents(subtotalCents);
        const igvCalculado = this.fromCents(igvCents);
        const totalCalculado = this.fromCents(totalCents);
        this.logger.log(
          `Registrando venta por total calculado S/ ${totalCalculado} - Comprobante: ${dto.tipo_comprobante} - Método: ${metodoPagoNombre}`,
        );

        let tipoMovVenta = await tx.tipos_movimientos_inventario.findFirst({
          where: { botica_id: boticaId, codigo: 'VENTA', deleted_at: null },
        });
        if (!tipoMovVenta) {
          tipoMovVenta = await tx.tipos_movimientos_inventario.create({
            data: {
              botica_id: boticaId,
              codigo: 'VENTA',
              descripcion: 'Salida por venta de productos',
              afecta_stock: -1,
              created_by: finalUsuarioId,
            },
          });
        }

        // 5. Crear la cabecera de la venta con importes calculados por el servidor.
        const venta = await tx.ventas.create({
          data: {
            botica_id: boticaId,
            idempotency_key: idempotencyKey,
            cliente_id: clienteId,
            usuario_id: finalUsuarioId,
            caja_id: caja.id,
            subtotal: subtotalCalculado,
            descuento: 0,
            igv: igvCalculado,
            total: totalCalculado,
            estado: 'EMITIDO',
            created_by: finalUsuarioId,
          },
        });

        // 6. Descontar stock FEFO. Los movimientos conservan la asignación exacta
        // de unidades base por lote para una anulación simétrica.
        for (const calculado of itemsCalculados) {
          const { item, presentacion, producto, cantidad, equivBase } =
            calculado;
          const unidadesRequeridas = cantidad * equivBase;
          let unidadesPendientes = unidadesRequeridas;
          let primerLoteId: string | null = null;
          let costoTotalBase = 0;
          const asignacionesLote: Array<{
            lote_id: string;
            unidades_base: number;
            costo_unitario_base: number;
          }> = [];
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const whereLotes: any = {
            producto_comercial_id: item.producto_comercial_id,
            sucursal_id: finalSucursalId,
            botica_id: boticaId,
            deleted_at: null,
            stock_actual: { gt: 0 },
          };
          if (producto.requiere_vencimiento)
            whereLotes.fecha_vencimiento = { gte: hoy };
          const lotesDisponibles = await tx.lotes.findMany({
            where: whereLotes,
            orderBy: [{ fecha_vencimiento: 'asc' }, { stock_actual: 'desc' }],
          });

          if (lotesDisponibles.length === 0)
            throw new BadRequestException(
              `Stock insuficiente para el producto ${item.producto_comercial_id}. No hay lotes con stock disponible.`,
            );

          const stockDisponible = lotesDisponibles.reduce(
            (total: number, lote: any) => total + Number(lote.stock_actual),
            0,
          );
          if (stockDisponible < unidadesRequeridas) {
            throw new BadRequestException(
              `Stock insuficiente para el producto ${item.producto_comercial_id}. Faltan ${unidadesRequeridas - stockDisponible} unidades base.`,
            );
          }

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

            primerLoteId ??= lote.id;
            const costoUnitarioBase = Number(lote.precio_compra_unidad_base);
            costoTotalBase += costoUnitarioBase * descontar;
            asignacionesLote.push({
              lote_id: lote.id,
              unidades_base: descontar,
              costo_unitario_base: costoUnitarioBase,
            });
          }

          if (unidadesPendientes > 0) {
            throw new BadRequestException(
              `Stock insuficiente para el producto ${item.producto_comercial_id}. Faltan ${unidadesPendientes} unidades base.`,
            );
          }
          if (!primerLoteId) {
            throw new BadRequestException(
              'No se pudo determinar el lote consumido por la venta.',
            );
          }
          const detalleVenta = await tx.detalles_ventas.create({
            data: {
              botica_id: boticaId,
              venta_id: venta.id,
              producto_presentacion_id: presentacion.id,
              // El esquema exige un lote. La asignación multilote exacta queda en
              // movimientos_inventario y este campo conserva el primer lote FEFO.
              lote_id: primerLoteId,
              cantidad,
              precio_unitario_presentacion: this.fromCents(
                calculado.precioUnitarioCents,
              ),
              costo_unitario_base: Number(
                (costoTotalBase / unidadesRequeridas).toFixed(4),
              ),
              unidades_base_por_presentacion: equivBase,
              descuento: 0,
              subtotal: this.fromCents(calculado.totalLineaCents),
              created_by: finalUsuarioId,
            },
          });
          await tx.detalle_venta_lotes.createMany({
            data: asignacionesLote.map((asignacion) => ({
              botica_id: boticaId,
              detalle_venta_id: detalleVenta.id,
              ...asignacion,
            })),
          });
        }

        // 6. Obtener o crear el Método de Pago exacto (EFECTIVO, TARJETA, YAPE_PLIN, TRANSFERENCIA)
        let metodoPago = await tx.metodos_pago.findFirst({
          where: {
            botica_id: boticaId,
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
            monto: totalCalculado,
            referencia: metodoPagoNombre,
            created_by: finalUsuarioId,
          },
        });

        // Snapshot inmutable: el enlace público no depende de datos que puedan cambiar luego.
        const [boticaSnapshot, detallesSnapshot] = await Promise.all([
          tx.boticas.findUnique({
            where: { id: boticaId },
            select: {
              nombre: true,
              razon_social: true,
              ruc: true,
              direccion: true,
              telefono: true,
            },
          }),
          tx.detalles_ventas.findMany({
            where: { venta_id: venta.id, deleted_at: null },
            include: {
              productos_presentaciones: {
                include: {
                  productos_comerciales: true,
                  unidades_presentacion: true,
                },
              },
            },
          }),
        ]);
        const snapshot = {
          version: 'a4-v1',
          venta_id: venta.id,
          emitido_at: venta.fecha,
          tipo_comprobante: dto.tipo_comprobante,
          metodo_pago: metodoPagoNombre,
          emisor: boticaSnapshot,
          cliente: cliente
            ? {
                nombre: cliente.nombre,
                documento: `${cliente.tipo_documento}: ${cliente.numero_documento}`,
                direccion: cliente.direccion,
              }
            : { nombre: 'CLIENTE GENERAL' },
          items: detallesSnapshot.map((d) => ({
            descripcion:
              d.productos_presentaciones.productos_comerciales.nombre_comercial,
            presentacion:
              d.productos_presentaciones.unidades_presentacion.nombre,
            cantidad: d.cantidad,
            precio_unitario: Number(d.precio_unitario_presentacion),
            subtotal: Number(d.subtotal),
          })),
          totales: {
            subtotal: Number(venta.subtotal),
            igv: Number(venta.igv),
            total: Number(venta.total),
          },
        };
        const hashDocumento = hashSnapshot(snapshot);
        const tokenPublico = randomBytes(32).toString('base64url');
        await tx.comprobantes_publicos.create({
          data: {
            venta_id: venta.id,
            botica_id: boticaId,
            token_publico: tokenPublico,
            plantilla_version: 'a4-v1',
            snapshot,
            hash_documento: hashDocumento,
          },
        });

        // Audit Log (Sección 23 Documento 02)
        await this.auditService.registrar({
          usuario_id: finalUsuarioId,
          accion: 'VENTA_CREADA',
          tabla: 'ventas',
          observacion: `Venta registrada por S/ ${totalCalculado} - ${dto.tipo_comprobante} (${metodoPagoNombre})`,
        });

        // WebSocket Real-time Event (Sección 22 Documento 02)
        this.eventsGateway.emitirEvento('venta.creada', {
          venta_id: venta.id,
          total: totalCalculado,
        });
        this.eventsGateway.emitirEvento('stock.actualizado', {
          sucursal_id: finalSucursalId,
        });

        return {
          exito: true,
          idempotente: false,
          mensaje: 'Venta registrada correctamente',
          venta_id: venta.id,
          idempotency_key: idempotencyKey,
          estado: venta.estado,
          subtotal: subtotalCalculado,
          igv: igvCalculado,
          total: totalCalculado,
          tipo_comprobante: dto.tipo_comprobante,
          metodo_pago: metodoPagoNombre,
          comprobante_token: tokenPublico,
          comprobante_url: `/c/${tokenPublico}`,
        };
      });
    } catch (error) {
      if (this.isIdempotencyConflict(error)) {
        const ventaGanadora = await this.findVentaIdempotente(
          this.prisma,
          boticaId,
          idempotencyKey,
        );
        if (ventaGanadora) return ventaGanadora;
      }
      throw error;
    }
  }

  async anular(id: string, boticaId: string, usuarioId?: string) {
    this.logger.log(`Anulando venta con ID: ${id}`);

    const res = await this.prisma.$transaction(async (tx) => {
      const venta = await tx.ventas.findFirst({
        where: { id, deleted_at: null, botica_id: boticaId },
        include: {
          detalles_ventas: {
            where: { deleted_at: null },
            include: {
              detalle_venta_lotes: { where: { botica_id: boticaId } },
            },
          },
        },
      });

      if (!venta) {
        throw new NotFoundException(`Venta con ID ${id} no encontrada`);
      }

      if (venta.estado === 'ANULADO') {
        throw new BadRequestException(
          `La venta ${id} ya fue anulada anteriormente.`,
        );
      }

      // La transición condicional evita que dos anulaciones repongan stock dos veces.
      const anulacion = await tx.ventas.updateMany({
        where: {
          id: venta.id,
          botica_id: boticaId,
          estado: 'EMITIDO',
          deleted_at: null,
        },
        data: {
          estado: 'ANULADO',
          updated_at: new Date(),
          updated_by: usuarioId,
        },
      });
      if (anulacion.count !== 1) {
        throw new BadRequestException(
          `La venta ${id} fue modificada o anulada por otra operación.`,
        );
      }

      // Un comprobante anulado nunca debe seguir siendo accesible con su enlace público.
      await tx.comprobantes_publicos.updateMany({
        where: { venta_id: venta.id, botica_id: boticaId, anulado_at: null },
        data: { anulado_at: new Date() },
      });

      // Fuente canónica para ventas nuevas: distribución inmutable por lote.
      const asignaciones = venta.detalles_ventas.flatMap(
        (detalle) => detalle.detalle_venta_lotes ?? [],
      );
      if (asignaciones.length > 0) {
        for (const asignacion of asignaciones) {
          const reposicion = await tx.lotes.updateMany({
            where: {
              id: asignacion.lote_id,
              botica_id: boticaId,
              deleted_at: null,
            },
            data: {
              stock_actual: { increment: asignacion.unidades_base },
            },
          });
          if (reposicion.count !== 1) {
            throw new BadRequestException(
              `No se pudo reponer el lote ${asignacion.lote_id} de la venta anulada.`,
            );
          }
        }
      } else {
        // Los movimientos de la venta son la fuente exacta de unidades base por lote.
        const tipoMovVenta = await tx.tipos_movimientos_inventario.findFirst({
          where: { botica_id: boticaId, codigo: 'VENTA', deleted_at: null },
        });
        const consumos = tipoMovVenta
          ? await tx.movimientos_inventario.findMany({
              where: {
                botica_id: boticaId,
                tipo_movimiento_id: tipoMovVenta.id,
                documento_referencia: venta.id,
                deleted_at: null,
              },
              select: { lote_id: true, cantidad: true },
            })
          : [];

        if (consumos.length > 0) {
          for (const consumo of consumos) {
            if (consumo.cantidad <= 0) continue;
            const reposicion = await tx.lotes.updateMany({
              where: {
                id: consumo.lote_id,
                botica_id: boticaId,
                deleted_at: null,
              },
              data: { stock_actual: { increment: consumo.cantidad } },
            });
            if (reposicion.count !== 1) {
              throw new BadRequestException(
                `No se pudo reponer el lote ${consumo.lote_id} de la venta anulada.`,
              );
            }
          }
        } else {
          // Compatibilidad con ventas históricas creadas antes de registrar consumos exactos.
          for (const detalle of venta.detalles_ventas) {
            if (!detalle.lote_id || detalle.cantidad <= 0) continue;
            let equivalencia = detalle.unidades_base_por_presentacion;
            if (!equivalencia) {
              const presentacion = await tx.productos_presentaciones.findFirst({
                where: {
                  id: detalle.producto_presentacion_id,
                  botica_id: boticaId,
                  deleted_at: null,
                },
              });
              equivalencia = Number(presentacion?.cantidad_unidad_base || 1);
            }
            const unidadesAReponer = detalle.cantidad * equivalencia;
            const reposicion = await tx.lotes.updateMany({
              where: {
                id: detalle.lote_id,
                botica_id: boticaId,
                deleted_at: null,
              },
              data: { stock_actual: { increment: unidadesAReponer } },
            });
            if (reposicion.count !== 1) {
              throw new BadRequestException(
                `No se pudo reponer el lote ${detalle.lote_id} de la venta histórica.`,
              );
            }
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
      lotes: {
        producto_comercial_id: productoComercialId,
      },
    };
    if (sucursalId) {
      whereMov.lotes.sucursal_id = sucursalId;
    }

    const movimientos = await this.prisma.movimientos_inventario.findMany({
      where: whereMov,
      include: {
        lotes: {
          select: { numero_lote: true, stock_actual: true },
        },
        tipos_movimientos_inventario: {
          select: { codigo: true, descripcion: true },
        },
        usuarios: {
          select: { nombre: true },
        },
      },
      orderBy: { fecha: 'desc' },
      take: 100,
    });

    return movimientos.map((m: any) => {
      const { lotes, tipos_movimientos_inventario, usuarios, ...rest } = m;
      return {
        ...rest,
        lote: lotes,
        tipo_movimiento: tipos_movimientos_inventario
          ? {
              codigo: tipos_movimientos_inventario.codigo,
              nombre: tipos_movimientos_inventario.descripcion,
            }
          : null,
        usuario: usuarios,
      };
    });
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
    const whereLote: any = {
      botica_id: boticaId,
      producto_comercial_id: productoComercialId,
      deleted_at: null,
      stock_actual: { gt: 0 },
      fecha_vencimiento: { gte: hoy },
    };
    if (sucursalId) {
      whereLote.sucursal_id = sucursalId;
    }

    const loteActivo = await this.prisma.lotes.findFirst({
      where: whereLote,
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
