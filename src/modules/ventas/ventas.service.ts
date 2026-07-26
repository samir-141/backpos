import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVentaDto } from './dto/create-venta.dto';

@Injectable()
export class VentasService {
    private readonly logger = new Logger(VentasService.name);

    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateVentaDto, sucursalId?: string, usuarioId?: string) {
        const metodoPagoNombre = String(dto.metodo_pago || 'EFECTIVO').trim().toUpperCase();
        this.logger.log(`Registrando venta por total S/ ${dto.total} - Comprobante: ${dto.tipo_comprobante} - Método: ${metodoPagoNombre}`);

        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException('La venta debe incluir al menos un producto.');
        }

        return await this.prisma.$transaction(async (tx) => {
            // 1. Obtener o asignar Sucursal y Usuario por defecto si no vienen en la petición
            let finalUsuarioId = usuarioId;
            if (!finalUsuarioId) {
                const primerUsuario = await tx.usuarios.findFirst({ where: { deleted_at: null } });
                if (!primerUsuario) {
                    throw new BadRequestException('No existe ningún usuario registrado en el sistema.');
                }
                finalUsuarioId = primerUsuario.id;
            }

            let finalSucursalId = sucursalId;
            if (!finalSucursalId) {
                const primeraSucursal = await tx.sucursales.findFirst({ where: { deleted_at: null } });
                if (!primeraSucursal) {
                    throw new BadRequestException('No existe ninguna sucursal registrada en el sistema.');
                }
                finalSucursalId = primeraSucursal.id;
            }

            // 2. Obtener o crear Caja activa para la sucursal
            let caja = await tx.cajas.findFirst({
                where: { sucursal_id: finalSucursalId, deleted_at: null }
            });

            if (!caja) {
                caja = await tx.cajas.create({
                    data: {
                        sucursal_id: finalSucursalId,
                        nombre: 'Caja Principal POS',
                        estado: 'ABIERTA',
                        created_by: finalUsuarioId,
                    }
                });
            }

            // 3. Obtener o crear Cliente si se proveyó
            let clienteId: string | null = null;
            if (dto.datos_cliente && dto.datos_cliente.numero_documento) {
                let cliente = await tx.clientes.findFirst({
                    where: { numero_documento: dto.datos_cliente.numero_documento, deleted_at: null }
                });

                if (!cliente) {
                    cliente = await tx.clientes.create({
                        data: {
                            tipo_documento: dto.datos_cliente.tipo_documento || 'DNI',
                            numero_documento: dto.datos_cliente.numero_documento,
                            nombre: dto.datos_cliente.nombre_razon_social || 'CLIENTE POS',
                            direccion: dto.datos_cliente.direccion || null,
                            created_by: finalUsuarioId,
                        }
                    });
                }

                clienteId = cliente.id;
            }

            // 4. Crear la cabecera de la Venta
            const venta = await tx.ventas.create({
                data: {
                    cliente_id: clienteId,
                    usuario_id: finalUsuarioId,
                    caja_id: caja.id,
                    subtotal: dto.subtotal,
                    descuento: 0,
                    igv: dto.igv,
                    total: dto.total,
                    estado: 'EMITIDO',
                    created_by: finalUsuarioId,
                }
            });

            // 5. Procesar los Detalles de la Venta y Descontar Stock FEFO Multilote
            for (const item of dto.items) {
                // A. Obtener presentación del producto
                let presentacion = await tx.productos_presentaciones.findFirst({
                    where: {
                        producto_comercial_id: item.producto_comercial_id,
                        deleted_at: null
                    }
                });

                if (!presentacion) {
                    presentacion = await tx.productos_presentaciones.create({
                        data: {
                            producto_comercial_id: item.producto_comercial_id,
                            unidad_presentacion_id: (await tx.unidades_presentacion.findFirst())?.id || '00000000-0000-0000-0000-000000000001',
                            cantidad_unidad_base: 1,
                            precio_actual: item.precio_unitario,
                            orden: 1,
                        }
                    });
                }

                let unidadesPendientes = item.cantidad * Number(presentacion.cantidad_unidad_base || 1);

                // Obtener todos los lotes disponibles ordenados por vencimiento (FEFO)
                const lotesDisponibles = await tx.lotes.findMany({
                    where: {
                        producto_comercial_id: item.producto_comercial_id,
                        sucursal_id: finalSucursalId,
                        stock_actual: { gt: 0 },
                        deleted_at: null
                    },
                    orderBy: { fecha_vencimiento: 'asc' }
                });

                if (lotesDisponibles.length === 0) {
                    const nuevoLote = await tx.lotes.create({
                        data: {
                            producto_comercial_id: item.producto_comercial_id,
                            sucursal_id: finalSucursalId,
                            numero_lote: 'LOTE-STD-' + Date.now().toString().slice(-6),
                            fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                            precio_compra_unidad_base: item.precio_unitario / 1.18,
                            stock_actual: Math.max(1000, unidadesPendientes),
                            created_by: finalUsuarioId,
                        }
                    });
                    lotesDisponibles.push(nuevoLote);
                }

                // Consumir lotes de forma iterativa según fecha de vencimiento FEFO
                for (const lote of lotesDisponibles) {
                    if (unidadesPendientes <= 0) break;

                    const descontar = Math.min(lote.stock_actual, unidadesPendientes);
                    unidadesPendientes -= descontar;

                    await tx.lotes.update({
                        where: { id: lote.id },
                        data: {
                            stock_actual: lote.stock_actual - descontar
                        }
                    });

                    await tx.detalles_ventas.create({
                        data: {
                            venta_id: venta.id,
                            producto_presentacion_id: presentacion.id,
                            lote_id: lote.id,
                            cantidad: Math.ceil(descontar / Number(presentacion.cantidad_unidad_base || 1)),
                            precio_unitario_presentacion: item.precio_unitario,
                            descuento: 0,
                            subtotal: item.precio_unitario * (descontar / Number(presentacion.cantidad_unidad_base || 1)),
                            created_by: finalUsuarioId,
                        }
                    });
                }
            }

            // 6. Obtener o crear el Método de Pago exacto (EFECTIVO, TARJETA, YAPE_PLIN, TRANSFERENCIA)
            let metodoPago = await tx.metodos_pago.findFirst({
                where: {
                    nombre: { equals: metodoPagoNombre, mode: 'insensitive' },
                    deleted_at: null
                }
            });

            if (!metodoPago) {
                metodoPago = await tx.metodos_pago.create({
                    data: {
                        nombre: metodoPagoNombre,
                        requiere_referencia: metodoPagoNombre !== 'EFECTIVO',
                        created_by: finalUsuarioId,
                    }
                });
            }

            // 7. Registrar el Pago con la referencia y el método exacto
            await tx.pagos.create({
                data: {
                    venta_id: venta.id,
                    metodo_pago_id: metodoPago.id,
                    monto: dto.total,
                    referencia: metodoPagoNombre,
                    created_by: finalUsuarioId,
                }
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

    async anular(id: string, usuarioId?: string) {
        this.logger.log(`Anulando venta con ID: ${id}`);

        return await this.prisma.$transaction(async (tx) => {
            const venta = await tx.ventas.findFirst({
                where: { id, deleted_at: null },
                include: { detalles_ventas: true }
            });

            if (!venta) {
                throw new NotFoundException(`Venta con ID ${id} no encontrada`);
            }

            if (venta.estado === 'ANULADO') {
                throw new BadRequestException(`La venta ${id} ya fue anulada anteriormente.`);
            }

            // 1. Marcar venta como ANULADO
            await tx.ventas.update({
                where: { id: venta.id },
                data: {
                    estado: 'ANULADO',
                    updated_at: new Date(),
                    updated_by: usuarioId,
                }
            });

            // 2. Reponer stock a los lotes consumidos
            for (const detalle of venta.detalles_ventas) {
                if (detalle.lote_id && detalle.cantidad > 0) {
                    const presentacion = await tx.productos_presentaciones.findFirst({
                        where: { id: detalle.producto_presentacion_id }
                    });
                    const equiv = Number(presentacion?.cantidad_unidad_base || 1);
                    const unidadesAReponer = detalle.cantidad * equiv;

                    const lote = await tx.lotes.findFirst({
                        where: { id: detalle.lote_id }
                    });

                    if (lote) {
                        await tx.lotes.update({
                            where: { id: lote.id },
                            data: {
                                stock_actual: lote.stock_actual + unidadesAReponer
                            }
                        });
                    }
                }
            }

            return {
                exito: true,
                mensaje: `Venta ${id} anulada exitosamente y stock repuesto en el inventario.`,
                venta_id: venta.id
            };
        });
    }

    async findAll() {
        return await this.prisma.ventas.findMany({
            where: { deleted_at: null },
            include: {
                detalles_ventas: true,
                pagos: {
                    include: { metodos_pago: true }
                },
                clientes: true,
            },
            orderBy: { fecha: 'desc' },
            take: 50,
        });
    }

    async findOne(id: string) {
        const venta = await this.prisma.ventas.findFirst({
            where: { id, deleted_at: null },
            include: {
                detalles_ventas: {
                    include: {
                        lotes: true,
                        productos_presentaciones: {
                            include: {
                                productos_comerciales: true
                            }
                        }
                    }
                },
                pagos: {
                    include: { metodos_pago: true }
                },
                clientes: true,
            }
        });

        if (!venta) {
            throw new NotFoundException(`Venta con ID ${id} no encontrada`);
        }

        return venta;
    }
}
