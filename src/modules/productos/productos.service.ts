// src/modules/productos/productos.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryProductosDto, OrdenProductos } from './dto/query-productos.dto';
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
    // src/modules/productos/productos.service.ts

    // ... (mantén los métodos findOne y create que ya tienes) ...

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

        // ✅ CRÍTICO: Convertir el total a Number (puede venir como BigInt)
        const total = Number(countResult[0]?.total ?? 0);

        return {
            data: (rows as any[]).map(ProductoMapper.toListaItem),
            meta: {
                total, // ✅ Ahora es Number, no BigInt
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ... (buildOrderBy se mantiene igual) ...

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