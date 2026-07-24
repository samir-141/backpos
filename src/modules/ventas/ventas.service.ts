import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVentaDto } from './dto/create-venta.dto';

@Injectable()
export class VentasService {
    private readonly logger = new Logger(VentasService.name);

    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateVentaDto, sucursalId?: string, usuarioId?: string) {
        this.logger.log(`Registrando venta por total S/ ${dto.total} - Comprobante: ${dto.tipo_comprobante}`);

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

            // 5. Procesar los Detalles de la Venta y Descontar Stock FEFO
            for (const item of dto.items) {
                // A. Obtener presentación del producto
                let presentacion = await tx.productos_presentaciones.findFirst({
                    where: {
                        producto_comercial_id: item.producto_comercial_id,
                        deleted_at: null
                    }
                });

                if (!presentacion) {
                    // Si no existe la presentación en base de datos, crear una por defecto
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

                // B. Obtener Lote disponible por FEFO
                let lote = await tx.lotes.findFirst({
                    where: {
                        producto_comercial_id: item.producto_comercial_id,
                        sucursal_id: finalSucursalId,
                        stock_actual: { gt: 0 },
                        deleted_at: null
                    },
                    orderBy: { fecha_vencimiento: 'asc' }
                });

                if (!lote) {
                    // Crear un lote de stock por defecto si no existe ninguno con stock positivo
                    lote = await tx.lotes.create({
                        data: {
                            producto_comercial_id: item.producto_comercial_id,
                            sucursal_id: finalSucursalId,
                            numero_lote: 'LOTE-STD-' + Date.now().toString().slice(-6),
                            fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                            precio_compra_unidad_base: item.precio_unitario / 1.18,
                            stock_actual: 1000,
                            created_by: finalUsuarioId,
                        }
                    });
                }

                const unidadesTotalesADescontar = item.cantidad * Number(presentacion.cantidad_unidad_base || 1);
                
                // Descontar stock del lote
                await tx.lotes.update({
                    where: { id: lote.id },
                    data: {
                        stock_actual: Math.max(0, lote.stock_actual - unidadesTotalesADescontar)
                    }
                });

                // Registrar el detalle de venta
                await tx.detalles_ventas.create({
                    data: {
                        venta_id: venta.id,
                        producto_presentacion_id: presentacion.id,
                        lote_id: lote.id,
                        cantidad: item.cantidad,
                        precio_unitario_presentacion: item.precio_unitario,
                        descuento: 0,
                        subtotal: item.precio_unitario * item.cantidad,
                        created_by: finalUsuarioId,
                    }
                });
            }

            // 6. Obtener o crear Método de Pago
            let metodoPago = await tx.metodos_pago.findFirst({
                where: { deleted_at: null }
            });

            if (!metodoPago) {
                metodoPago = await tx.metodos_pago.create({
                    data: {
                        nombre: dto.metodo_pago || 'EFECTIVO',
                        requiere_referencia: false,
                        created_by: finalUsuarioId,
                    }
                });
            }

            // 7. Registrar el Pago
            await tx.pagos.create({
                data: {
                    venta_id: venta.id,
                    metodo_pago_id: metodoPago.id,
                    monto: dto.total,
                    referencia: dto.metodo_pago,
                    created_by: finalUsuarioId,
                }
            });

            return {
                exito: true,
                mensaje: 'Venta registrada correctamente',
                venta_id: venta.id,
                total: dto.total,
                tipo_comprobante: dto.tipo_comprobante,
            };
        });
    }

    async findAll() {
        return await this.prisma.ventas.findMany({
            where: { deleted_at: null },
            include: {
                detalles_ventas: true,
                pagos: true,
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
                        productos_presentaciones: {
                            include: {
                                productos_comerciales: true
                            }
                        }
                    }
                },
                pagos: true,
                clientes: true,
            }
        });

        if (!venta) {
            throw new NotFoundException(`Venta con ID ${id} no encontrada`);
        }

        return venta;
    }
}
