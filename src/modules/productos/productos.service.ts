// src/modules/productos/productos.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryProductosDto, OrdenProductos } from './dto/query-productos.dto';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { ProductoDetalleResponse } from './responses/producto-detalle.response';
import { ProductoListaResponse } from './responses/producto-lista.response';
import { ProductoMapper } from './mappers/producto.mapper';

@Injectable()
export class ProductosService {
    private readonly logger = new Logger(ProductosService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Obtiene el detalle completo de un producto por su ID.
     * Usa las relaciones de Prisma con includes anidados.
     */
    async findOne(id: string): Promise<ProductoDetalleResponse> {
        this.logger.log(`Buscando producto por ID: ${id}`);

        const producto = await this.prisma.productos_comerciales.findFirst({
            where: {
                id,
                deleted_at: null,
                medicamentos: { deleted_at: null },
            },
            include: {
                medicamentos: {
                    include: {
                        principios_activos: { select: { id: true, nombre: true } },
                        formas_farmaceuticas: { select: { id: true, nombre: true } },
                    },
                },
                laboratorios: { select: { id: true, nombre: true, pais: true } },
                categorias: { select: { id: true, nombre: true } },
                unidades_presentacion: {
                    select: { id: true, nombre: true, abreviatura: true },
                },
                productos_presentaciones: {
                    where: { deleted_at: null },
                    include: {
                        unidades_presentacion: {
                            select: { id: true, nombre: true, abreviatura: true },
                        },
                    },
                    orderBy: { orden: 'asc' },
                },
            },
        });

        if (!producto) {
            throw new NotFoundException(`Producto con ID ${id} no encontrado`);
        }

        return ProductoMapper.toDetalleResponse(producto);
    }

    /**
     * Lista productos usando la vista optimizada vw_productos_pos.
     * Soporta paginación, búsqueda y filtros.
     */
    async findAll(query: QueryProductosDto): Promise<ProductoListaResponse> {
        const { page = 1, limit = 20, buscar, laboratorio_id, categoria_id, principio_activo_id, orden } = query;
        const offset = (page - 1) * limit;

        this.logger.log(`Listando productos - Página: ${page}, Límite: ${limit}`);

        // Construimos los filtros dinámicamente
        const condiciones: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (buscar) {
            condiciones.push(`
        (LOWER(nombre_comercial) LIKE $${paramIndex}
         OR LOWER(sku) LIKE $${paramIndex}
         OR LOWER(codigo_barras) LIKE $${paramIndex}
         OR LOWER(codigo_interno) LIKE $${paramIndex})
      `);
            params.push(`%${buscar.toLowerCase()}%`);
            paramIndex++;
        }

        if (laboratorio_id) {
            condiciones.push(`laboratorio = (SELECT nombre FROM public.laboratorios WHERE id = $${paramIndex}::uuid)`);
            params.push(laboratorio_id);
            paramIndex++;
        }

        if (categoria_id) {
            condiciones.push(`categoria = (SELECT nombre FROM public.categorias WHERE id = $${paramIndex}::uuid)`);
            params.push(categoria_id);
            paramIndex++;
        }

        if (principio_activo_id) {
            condiciones.push(`principio_activo = (SELECT nombre FROM public.principios_activos WHERE id = $${paramIndex}::uuid)`);
            params.push(principio_activo_id);
            paramIndex++;
        }

        if (query.sucursal_id) {
            condiciones.push(`producto_comercial_id IN (SELECT DISTINCT producto_comercial_id FROM public.lotes WHERE sucursal_id = $${paramIndex}::uuid AND deleted_at IS NULL AND stock_actual > 0)`);
            params.push(query.sucursal_id);
            paramIndex++;
        }

        const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

        const orderByClause = this.buildOrderBy(orden);

        // Agregar LIMIT y OFFSET a los parámetros
        params.push(limit, offset);

        // Consulta de datos con paginación
        const queryData = `
      SELECT * FROM public.vw_productos_pos
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        // Consulta de total (para metadata)
        const queryCount = `
      SELECT COUNT(*)::int AS total FROM public.vw_productos_pos
      ${whereClause}
    `;

        const [rows, countResult] = await Promise.all([
            this.prisma.queryRaw(queryData, params),
            this.prisma.queryRaw<{ total: number }>(queryCount, params.slice(0, -2)), // Sin LIMIT/OFFSET
        ]);

        // Convertir el total a Number
        const total = Number(countResult[0]?.total ?? 0);

        return {
            data: (rows as any[]).map(ProductoMapper.toListaItem),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Crea un nuevo producto comercial en la base de datos de manera transaccional,
     * o agrega una nueva presentación a un producto comercial existente.
     */
    async create(dto: CreateProductoDto) {
        // --- CASO 1: AGREGAR PRESENTACION A PRODUCTO EXISTENTE ---
        if (dto.producto_comercial_id) {
            this.logger.log(`Agregando presentación a producto comercial existente: ${dto.producto_comercial_id}`);

            // A. Verificar existencia del producto comercial
            const prod = await this.prisma.productos_comerciales.findFirst({
                where: { id: dto.producto_comercial_id, deleted_at: null }
            });
            if (!prod) {
                throw new NotFoundException(`Producto comercial con ID ${dto.producto_comercial_id} no encontrado`);
            }

            // B. Validar que la presentación no exista ya para este producto
            const presExistente = await this.prisma.productos_presentaciones.findFirst({
                where: {
                    producto_comercial_id: dto.producto_comercial_id,
                    unidad_presentacion_id: dto.presentacion_id,
                    deleted_at: null
                }
            });
            if (presExistente) {
                throw new BadRequestException('Esta presentación ya está registrada para el producto');
            }

            // C. Validar código de barras único
            if (dto.codigo_barras) {
                const barrasExistente = await this.prisma.productos_presentaciones.findFirst({
                    where: { codigo_barras: dto.codigo_barras, deleted_at: null }
                });
                if (barrasExistente) {
                    throw new BadRequestException(`El código de barras "${dto.codigo_barras}" ya está registrado.`);
                }
            }

            // D. Crear la presentación
            const presentacion = await this.prisma.productos_presentaciones.create({
                data: {
                    producto_comercial_id: dto.producto_comercial_id,
                    unidad_presentacion_id: dto.presentacion_id,
                    cantidad_unidad_base: dto.cantidad_unidad_base,
                    codigo_barras: dto.codigo_barras || null,
                    precio_actual: dto.precio_actual,
                    orden: 1
                }
            });

            // E. Obtener el producto de la vista
            const rows = await this.prisma.queryRaw(
                `SELECT * FROM public.vw_productos_pos WHERE producto_comercial_id = $1::uuid AND presentacion_id = $2::uuid LIMIT 1`,
                [dto.producto_comercial_id, presentacion.unidad_presentacion_id]
            );

            if (!rows || rows.length === 0) {
                throw new NotFoundException('Error al recuperar el producto creado');
            }

            return ProductoMapper.toListaItem(rows[0]);
        }

        // --- CASO 2: CREAR PRODUCTO NUEVO ---
        this.logger.log(`Creando nuevo producto comercial: ${dto.nombre_comercial}`);

        // Validaciones obligatorias si es creación de cero
        if (!dto.nombre_comercial || !dto.sku || !dto.principio_activo_id || !dto.forma_farmaceutica_id || 
            !dto.laboratorio_id || !dto.categoria_id || dto.concentracion === undefined || !dto.unidad_concentracion || 
            !dto.via_administracion) {
            throw new BadRequestException('Faltan campos obligatorios para registrar un nuevo producto.');
        }

        // 1. Validar SKU único en productos comerciales activos
        const skuExistente = await this.prisma.productos_comerciales.findFirst({
            where: { sku: dto.sku, deleted_at: null },
        });
        if (skuExistente) {
            throw new BadRequestException(`El SKU "${dto.sku}" ya está registrado.`);
        }

        // 2. Validar Código Interno único si se proporciona
        if (dto.codigo_interno) {
            const internoExistente = await this.prisma.productos_comerciales.findFirst({
                where: { codigo_interno: dto.codigo_interno, deleted_at: null },
            });
            if (internoExistente) {
                throw new BadRequestException(`El código interno "${dto.codigo_interno}" ya está registrado.`);
            }
        }

        // 3. Validar Código de Barras único en presentaciones activas
        if (dto.codigo_barras) {
            const barrasExistente = await this.prisma.productos_presentaciones.findFirst({
                where: { codigo_barras: dto.codigo_barras, deleted_at: null },
            });
            if (barrasExistente) {
                throw new BadRequestException(`El código de barras "${dto.codigo_barras}" ya está registrado.`);
            }
        }

        // 4. Ejecutar creación transaccional
        const result = await this.prisma.$transaction(async (tx) => {
            // A. Buscar o crear Medicamento
            let medicamento = await tx.medicamentos.findFirst({
                where: {
                    principio_activo_id: dto.principio_activo_id,
                    forma_farmaceutica_id: dto.forma_farmaceutica_id,
                    concentracion: dto.concentracion,
                    unidad_concentracion: dto.unidad_concentracion,
                    via_administracion: dto.via_administracion,
                    deleted_at: null,
                },
            });

            if (!medicamento) {
                medicamento = await tx.medicamentos.create({
                    data: {
                        principio_activo_id: dto.principio_activo_id!,
                        forma_farmaceutica_id: dto.forma_farmaceutica_id!,
                        concentracion: dto.concentracion!,
                        unidad_concentracion: dto.unidad_concentracion!,
                        via_administracion: dto.via_administracion!,
                        requiere_receta: dto.requiere_receta ?? false,
                        afecto_igv: dto.afecto_igv ?? true,
                    },
                });
            }

            // B. Crear Producto Comercial
            const productoComercial = await tx.productos_comerciales.create({
                data: {
                    nombre_comercial: dto.nombre_comercial!,
                    sku: dto.sku!,
                    codigo_interno: dto.codigo_interno || null,
                    medicamento_id: medicamento.id,
                    laboratorio_id: dto.laboratorio_id!,
                    categoria_id: dto.categoria_id!,
                    unidad_base_id: dto.presentacion_id, // Usamos la presentación como la unidad base inicial
                    estado: 'ACTIVO',
                },
            });

            // C. Crear Producto Presentación
            const presentacion = await tx.productos_presentaciones.create({
                data: {
                    producto_comercial_id: productoComercial.id,
                    unidad_presentacion_id: dto.presentacion_id,
                    cantidad_unidad_base: dto.cantidad_unidad_base,
                    codigo_barras: dto.codigo_barras || null,
                    precio_actual: dto.precio_actual,
                    orden: 1,
                },
            });

            return { productoComercialId: productoComercial.id, presentacionId: presentacion.unidad_presentacion_id };
        });

        // 5. Devolver el producto formateado como ProductoListaItemResponse consultando la vista
        const rows = await this.prisma.queryRaw(
            `SELECT * FROM public.vw_productos_pos WHERE producto_comercial_id = $1::uuid AND presentacion_id = $2::uuid LIMIT 1`,
            [result.productoComercialId, result.presentacionId]
        );

        if (!rows || rows.length === 0) {
            throw new NotFoundException('Error al recuperar el producto creado');
        }

        return ProductoMapper.toListaItem(rows[0]);
    }

    /**
     * Busca un producto comercial existente o una presentación por SKU, código de barras o código interno.
     */
    async buscarPorIdentificador(valor: string) {
        this.logger.log(`Buscando producto existente por identificador: ${valor}`);

        if (!valor || !valor.trim()) {
            throw new BadRequestException('Debe proporcionar un identificador de búsqueda');
        }

        const cleanVal = valor.trim();

        // 1. Buscar en presentaciones por código de barras
        const pres = await this.prisma.productos_presentaciones.findFirst({
            where: { codigo_barras: cleanVal, deleted_at: null },
            include: {
                productos_comerciales: {
                    include: {
                        medicamentos: {
                            include: {
                                principios_activos: { select: { id: true, nombre: true } },
                                formas_farmaceuticas: { select: { id: true, nombre: true } },
                            }
                        },
                        laboratorios: { select: { id: true, nombre: true } },
                        categorias: { select: { id: true, nombre: true } },
                    }
                }
            }
        });

        if (pres) {
            return {
                encontrado: true,
                tipo: 'PRESENTACION',
                producto_comercial_id: pres.producto_comercial_id,
                nombre_comercial: pres.productos_comerciales.nombre_comercial,
                sku: pres.productos_comerciales.sku,
                codigo_interno: pres.productos_comerciales.codigo_interno,
                principio_activo_id: pres.productos_comerciales.medicamentos.principio_activo_id,
                forma_farmaceutica_id: pres.productos_comerciales.medicamentos.forma_farmaceutica_id,
                laboratorio_id: pres.productos_comerciales.laboratorio_id,
                categoria_id: pres.productos_comerciales.categoria_id,
                concentracion: Number(pres.productos_comerciales.medicamentos.concentracion),
                unidad_concentracion: pres.productos_comerciales.medicamentos.unidad_concentracion,
                via_administracion: pres.productos_comerciales.medicamentos.via_administracion,
                requiere_receta: pres.productos_comerciales.medicamentos.requiere_receta,
                afecto_igv: pres.productos_comerciales.medicamentos.afecto_igv,
            };
        }

        // 2. Buscar en productos comerciales por SKU o Código Interno
        const prod = await this.prisma.productos_comerciales.findFirst({
            where: {
                OR: [
                    { sku: cleanVal },
                    { codigo_interno: cleanVal }
                ],
                deleted_at: null
            },
            include: {
                medicamentos: {
                    include: {
                        principios_activos: { select: { id: true, nombre: true } },
                        formas_farmaceuticas: { select: { id: true, nombre: true } },
                    }
                },
                laboratorios: { select: { id: true, nombre: true } },
                categorias: { select: { id: true, nombre: true } },
            }
        });

        if (prod) {
            return {
                encontrado: true,
                tipo: 'PRODUCTO_COMERCIAL',
                producto_comercial_id: prod.id,
                nombre_comercial: prod.nombre_comercial,
                sku: prod.sku,
                codigo_interno: prod.codigo_interno,
                principio_activo_id: prod.medicamentos.principio_activo_id,
                forma_farmaceutica_id: prod.medicamentos.forma_farmaceutica_id,
                laboratorio_id: prod.laboratorio_id,
                categoria_id: prod.categoria_id,
                concentracion: Number(prod.medicamentos.concentracion),
                unidad_concentracion: prod.medicamentos.unidad_concentracion,
                via_administracion: prod.medicamentos.via_administracion,
                requiere_receta: prod.medicamentos.requiere_receta,
                afecto_igv: prod.medicamentos.afecto_igv,
            };
        }

        return { encontrado: false };
    }

    /**
     * Actualiza los campos editables del producto comercial y su respectiva presentación.
     */
    async update(id: string, dto: UpdateProductoDto) {
        this.logger.log(`Actualizando producto por ID: ${id}`);

        // 1. Verificar que el producto comercial exista
        const productoComercial = await this.prisma.productos_comerciales.findFirst({
            where: { id, deleted_at: null }
        });
        if (!productoComercial) {
            throw new NotFoundException(`Producto comercial con ID ${id} no encontrado`);
        }

        // 2. Si se cambia el código de barras, validar que sea único
        if (dto.codigo_barras) {
            const barrasExistente = await this.prisma.productos_presentaciones.findFirst({
                where: {
                    codigo_barras: dto.codigo_barras,
                    deleted_at: null,
                    NOT: { producto_comercial_id: id } // Permitir el mismo producto
                },
            });
            if (barrasExistente) {
                throw new BadRequestException(`El código de barras "${dto.codigo_barras}" ya está registrado.`);
            }
        }

        // 3. Ejecutar actualizaciones en transacción
        const updatedPresentacionId = await this.prisma.$transaction(async (tx) => {
            // A. Si se envían flags del medicamento, actualizar el medicamento correspondiente
            if (dto.requiere_receta !== undefined || dto.afecto_igv !== undefined) {
                const updateData: any = {};
                if (dto.requiere_receta !== undefined) updateData.requiere_receta = dto.requiere_receta;
                if (dto.afecto_igv !== undefined) updateData.afecto_igv = dto.afecto_igv;

                await tx.medicamentos.update({
                    where: { id: productoComercial.medicamento_id },
                    data: updateData
                });
            }

            // B. Si se edita la presentación específica (precio y código de barras)
            let presentacionId = dto.presentacion_id || productoComercial.unidad_base_id;

            // Buscamos si existe la presentación para este producto
            const presentacion = await tx.productos_presentaciones.findFirst({
                where: {
                    producto_comercial_id: id,
                    unidad_presentacion_id: presentacionId,
                    deleted_at: null
                }
            });

            if (presentacion) {
                const updatePresData: any = {};
                if (dto.precio_actual !== undefined) updatePresData.precio_actual = dto.precio_actual;
                if (dto.codigo_barras !== undefined) updatePresData.codigo_barras = dto.codigo_barras || null;

                await tx.productos_presentaciones.update({
                    where: { id: presentacion.id },
                    data: updatePresData
                });
            } else {
                // Si no la encuentra, intentamos con la primera presentación
                const primeraPres = await tx.productos_presentaciones.findFirst({
                    where: { producto_comercial_id: id, deleted_at: null }
                });
                if (primeraPres) {
                    presentacionId = primeraPres.unidad_presentacion_id;
                    const updatePresData: any = {};
                    if (dto.precio_actual !== undefined) updatePresData.precio_actual = dto.precio_actual;
                    if (dto.codigo_barras !== undefined) updatePresData.codigo_barras = dto.codigo_barras || null;

                    await tx.productos_presentaciones.update({
                        where: { id: primeraPres.id },
                        data: updatePresData
                    });
                }
            }

            return presentacionId;
        });

        // 4. Retornar el producto actualizado consultando la vista
        const rows = await this.prisma.queryRaw(
            `SELECT * FROM public.vw_productos_pos WHERE producto_comercial_id = $1::uuid AND presentacion_id = $2::uuid LIMIT 1`,
            [id, updatedPresentacionId]
        );

        if (!rows || rows.length === 0) {
            throw new NotFoundException('Error al recuperar el producto actualizado');
        }

        return ProductoMapper.toListaItem(rows[0]);
    }

    /**
     * Realiza soft delete de un producto comercial y de todas sus presentaciones asociadas.
     */
    async remove(id: string): Promise<{ mensaje: string }> {
        this.logger.log(`Eliminando (soft delete) producto con ID: ${id}`);

        // 1. Verificar si existe y no está eliminado
        const producto = await this.prisma.productos_comerciales.findFirst({
            where: { id, deleted_at: null }
        });
        if (!producto) {
            throw new NotFoundException(`Producto con ID ${id} no encontrado`);
        }

        // 2. Ejecutar soft delete en cascada
        const ahora = new Date();
        await this.prisma.$transaction(async (tx) => {
            // A. Soft delete producto comercial
            await tx.productos_comerciales.update({
                where: { id },
                data: { deleted_at: ahora }
            });

            // B. Soft delete sus presentaciones correspondientes
            await tx.productos_presentaciones.updateMany({
                where: { producto_comercial_id: id, deleted_at: null },
                data: { deleted_at: ahora }
            });
        });

        return { mensaje: 'Producto eliminado correctamente' };
    }

    /**
     * Construye la cláusula ORDER BY según el enum de ordenamiento
     */
    private buildOrderBy(orden?: OrdenProductos): string {
        switch (orden) {
            case OrdenProductos.NOMBRE_DESC:
                return 'ORDER BY nombre_comercial DESC';
            case OrdenProductos.PRECIO_ASC:
                return 'ORDER BY precio_actual ASC';
            case OrdenProductos.PRECIO_DESC:
                return 'ORDER BY precio_actual DESC';
            case OrdenProductos.STOCK_ASC:
                return 'ORDER BY stock_total ASC';
            case OrdenProductos.STOCK_DESC:
                return 'ORDER BY stock_total DESC';
            case OrdenProductos.NOMBRE_ASC:
            default:
                return 'ORDER BY nombre_comercial ASC';
        }
    }
}