// src/productos/productos.controller.ts
import { Controller, Get, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('productos')
export class ProductosController {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Obtener catálogo completo para POS con stock disponible
     * @param sucursalId - ID de la sucursal actual (obligatorio)
     */
    @Get('todos')
    async findAll(@Query('sucursalId') sucursalId: string) {
        if (!sucursalId) {
            throw new BadRequestException('El ID de sucursal es obligatorio');
        }

        const productos = await this.prisma.productos_comerciales.findMany({
            where: {
                deleted_at: null,
                estado: 'ACTIVO',
                // Filtrar por lotes con stock en la sucursal
                lotes: {
                    some: {
                        sucursal_id: sucursalId,
                        stock_actual: { gt: 0 },
                        deleted_at: null,
                        fecha_vencimiento: { gt: new Date() } // Solo productos vigentes
                    }
                }
            },
            select: {
                id: true,
                nombre_comercial: true,
                sku: true,
                codigo_interno: true,
                registro_sanitario: true,
                medicamentos: {
                    select: {
                        id: true,
                        concentracion: true,
                        unidad_concentracion: true,
                        via_administracion: true,
                        requiere_receta: true,
                        principios_activos: {
                            select: {
                                id: true,
                                nombre: true
                            }
                        },
                        formas_farmaceuticas: {
                            select: {
                                id: true,
                                nombre: true
                            }
                        }
                    }
                },
                laboratorios: {
                    select: {
                        id: true,
                        nombre: true,
                        pais: true
                    }
                },
                categorias: {
                    select: {
                        id: true,
                        nombre: true
                    }
                },
                unidades_presentacion: {
                    select: {
                        id: true,
                        nombre: true,
                        abreviatura: true
                    }
                },
                productos_presentaciones: {
                    where: {
                        deleted_at: null
                    },
                    select: {
                        id: true,
                        cantidad_unidad_base: true,
                        codigo_barras: true,
                        precio_actual: true,
                        orden: true,
                        unidades_presentacion: {
                            select: {
                                id: true,
                                nombre: true,
                                abreviatura: true
                            }
                        }
                    },
                    orderBy: {
                        orden: 'asc'
                    }
                },
                // Obtener el stock total disponible por sucursal
                lotes: {
                    where: {
                        sucursal_id: sucursalId,
                        stock_actual: { gt: 0 },
                        deleted_at: null,
                        fecha_vencimiento: { gt: new Date() }
                    },
                    select: {
                        id: true,
                        numero_lote: true,
                        stock_actual: true,
                        fecha_vencimiento: true,
                        precio_compra_unidad_base: true
                    },
                    orderBy: {
                        fecha_vencimiento: 'asc' // FIFO: primero los que vencen antes
                    }
                }
            },
            orderBy: {
                nombre_comercial: 'asc'
            }
        });

        // Transformar datos para el POS
        return productos.map(producto => ({
            ...producto,
            stock_total: producto.lotes.reduce((sum, lote) => sum + lote.stock_actual, 0),
            presentaciones: producto.productos_presentaciones.map(presentacion => ({
                ...presentacion,
                // Calcular precio por unidad base si es necesario
                precio_por_unidad_base: Number(presentacion.precio_actual) / Number(presentacion.cantidad_unidad_base)
            })),
            lotes_disponibles: producto.lotes.map(lote => ({
                ...lote,
                // Añadir información de presentación al lote
                presentacion: producto.productos_presentaciones.find(p =>
                    p.id === lote.id
                )
            }))
        }));
    }

    /**
     * Buscar producto por código de barras para POS
     * @param barcode - Código de barras escaneado
     * @param sucursalId - ID de la sucursal actual (obligatorio)
     */
    @Get('codigo/:barcode')
    async findByBarcode(
        @Param('barcode') barcode: string,
        @Query('sucursalId') sucursalId: string
    ) {
        if (!sucursalId) {
            throw new BadRequestException('El ID de sucursal es obligatorio');
        }

        // Primero encontrar la presentación por código de barras
        const presentacion = await this.prisma.productos_presentaciones.findFirst({
            where: {
                codigo_barras: barcode,
                deleted_at: null,
                productos_comerciales: {
                    deleted_at: null,
                    estado: 'ACTIVO',
                    lotes: {
                        some: {
                            sucursal_id: sucursalId,
                            stock_actual: { gt: 0 },
                            deleted_at: null,
                            fecha_vencimiento: { gt: new Date() }
                        }
                    }
                }
            },
            select: {
                id: true,
                cantidad_unidad_base: true,
                codigo_barras: true,
                precio_actual: true,
                orden: true,
                unidades_presentacion: {
                    select: {
                        id: true,
                        nombre: true,
                        abreviatura: true
                    }
                },
                productos_comerciales: {
                    select: {
                        id: true,
                        nombre_comercial: true,
                        sku: true,
                        codigo_interno: true,
                        registro_sanitario: true,
                        medicamentos: {
                            select: {
                                id: true,
                                concentracion: true,
                                unidad_concentracion: true,
                                via_administracion: true,
                                requiere_receta: true,
                                principios_activos: {
                                    select: {
                                        id: true,
                                        nombre: true
                                    }
                                },
                                formas_farmaceuticas: {
                                    select: {
                                        id: true,
                                        nombre: true
                                    }
                                }
                            }
                        },
                        laboratorios: {
                            select: {
                                id: true,
                                nombre: true,
                                pais: true
                            }
                        },
                        categorias: {
                            select: {
                                id: true,
                                nombre: true
                            }
                        },
                        unidades_presentacion: {
                            select: {
                                id: true,
                                nombre: true,
                                abreviatura: true
                            }
                        },
                        // Obtener lotes disponibles para esta presentación específica
                        lotes: {
                            where: {
                                sucursal_id: sucursalId,
                                stock_actual: { gt: 0 },
                                deleted_at: null,
                                fecha_vencimiento: { gt: new Date() }
                            },
                            select: {
                                id: true,
                                numero_lote: true,
                                stock_actual: true,
                                fecha_vencimiento: true,
                                precio_compra_unidad_base: true
                            },
                            orderBy: {
                                fecha_vencimiento: 'asc'
                            }
                        }
                    }
                }
            }
        });

        if (!presentacion) {
            throw new NotFoundException('El código de barras escaneado no existe o no tiene stock disponible');
        }

        // Calcular stock total para esta presentación específica
        const lotes = presentacion.productos_comerciales.lotes;
        const stock_total = lotes.reduce((sum, lote) => sum + lote.stock_actual, 0);

        return {
            ...presentacion,
            stock_total,
            // Información adicional útil para el POS
            detalles_venta: {
                producto_id: presentacion.productos_comerciales.id,
                presentacion_id: presentacion.id,
                nombre: `${presentacion.productos_comerciales.nombre_comercial} - ${presentacion.unidades_presentacion.abreviatura}`,
                precio_unitario: presentacion.precio_actual,
                stock_disponible: stock_total,
                lotes_disponibles: lotes.map(lote => ({
                    lote_id: lote.id,
                    numero: lote.numero_lote,
                    stock: lote.stock_actual,
                    vencimiento: lote.fecha_vencimiento
                }))
            }
        };
    }

    /**
     * Buscar productos por término de búsqueda (para POS)
     */
    @Get('buscar')
    async searchProducts(
        @Query('termino') termino: string,
        @Query('sucursalId') sucursalId: string
    ) {
        if (!sucursalId) {
            throw new BadRequestException('El ID de sucursal es obligatorio');
        }

        if (!termino || termino.length < 2) {
            throw new BadRequestException('El término de búsqueda debe tener al menos 2 caracteres');
        }

        const productos = await this.prisma.productos_comerciales.findMany({
            where: {
                deleted_at: null,
                estado: 'ACTIVO',
                OR: [
                    { nombre_comercial: { contains: termino, mode: 'insensitive' } },
                    { sku: { contains: termino, mode: 'insensitive' } },
                    { codigo_interno: { contains: termino, mode: 'insensitive' } },
                    {
                        medicamentos: {
                            principios_activos: {
                                nombre: { contains: termino, mode: 'insensitive' }
                            }
                        }
                    },
                    {
                        medicamentos: {
                            formas_farmaceuticas: {
                                nombre: { contains: termino, mode: 'insensitive' }
                            }
                        }
                    }
                ],
                lotes: {
                    some: {
                        sucursal_id: sucursalId,
                        stock_actual: { gt: 0 },
                        deleted_at: null,
                        fecha_vencimiento: { gt: new Date() }
                    }
                }
            },
            select: {
                id: true,
                nombre_comercial: true,
                sku: true,
                medicamentos: {
                    select: {
                        principios_activos: {
                            select: {
                                nombre: true
                            }
                        }
                    }
                },
                laboratorios: {
                    select: {
                        nombre: true
                    }
                },
                productos_presentaciones: {
                    where: {
                        deleted_at: null
                    },
                    select: {
                        id: true,
                        codigo_barras: true,
                        precio_actual: true,
                        unidades_presentacion: {
                            select: {
                                nombre: true,
                                abreviatura: true
                            }
                        }
                    }
                },
                lotes: {
                    where: {
                        sucursal_id: sucursalId,
                        stock_actual: { gt: 0 },
                        deleted_at: null,
                        fecha_vencimiento: { gt: new Date() }
                    },
                    select: {
                        stock_actual: true
                    }
                }
            },
            take: 20 // Limitar resultados para rendimiento
        });

        return productos.map(producto => ({
            ...producto,
            stock_total: producto.lotes.reduce((sum, lote) => sum + lote.stock_actual, 0)
        }));
    }
}