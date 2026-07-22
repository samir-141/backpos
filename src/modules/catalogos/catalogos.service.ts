// src/modules/catalogos/catalogos.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
    CATALOGOS_CONFIG,
    TipoCatalogo,
    TIPOS_CATALOGO,
} from './constants/catalogos.constants';
import { CreateCatalogoDto } from './dto/create-catalogo.dto';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto';
import { QueryCatalogosDto } from './dto/query-catalogos.dto';
import { ICatalogoItem, ICatalogoListaResponse } from './interfaces/catalogo.interface';

@Injectable()
export class CatalogosService {
    private readonly logger = new Logger(CatalogosService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Valida que el tipo de catálogo sea soportado
     */
    private validarTipo(tipo: string): TipoCatalogo {
        if (!TIPOS_CATALOGO.includes(tipo as TipoCatalogo)) {
            throw new BadRequestException(
                `Tipo de catálogo inválido. Soportados: ${TIPOS_CATALOGO.join(', ')}`,
            );
        }
        return tipo as TipoCatalogo;
    }

    /**
     * Lista todos los items de un catálogo con paginación y búsqueda
     */
    async findAll(
        tipo: string,
        query: QueryCatalogosDto,
    ): Promise<ICatalogoListaResponse> {
        const tipoValido = this.validarTipo(tipo);
        const config = CATALOGOS_CONFIG[tipoValido];
        const { page = 1, limit = 20, buscar, orden = 'asc' } = query;
        const offset = (page - 1) * limit;

        const condiciones: string[] = ['deleted_at IS NULL'];
        const params: any[] = [];
        let paramIndex = 1;

        if (buscar) {
            condiciones.push(`LOWER(nombre) LIKE $${paramIndex}`);
            params.push(`%${buscar.toLowerCase()}%`);
            paramIndex++;
        }

        const whereClause = `WHERE ${condiciones.join(' AND ')}`;
        const orderByClause = `ORDER BY nombre ${orden === 'asc' ? 'ASC' : 'DESC'}`;

        params.push(limit, offset);

        const queryData = `
      SELECT * FROM public.${config.tabla}
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        const queryCount = `
      SELECT COUNT(*)::int AS total FROM public.${config.tabla}
      ${whereClause}
    `;

        const [rows, countResult] = await Promise.all([
            this.prisma.queryRaw(queryData, params),
            this.prisma.queryRaw<{ total: number }>(queryCount, params.slice(0, -2)),
        ]);

        const total = Number(countResult[0]?.total ?? 0);

        return {
            data: rows as ICatalogoItem[],
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Obtiene un item por ID
     */
    async findOne(tipo: string, id: string): Promise<ICatalogoItem> {
        const tipoValido = this.validarTipo(tipo);
        const config = CATALOGOS_CONFIG[tipoValido];

        const rows = await this.prisma.queryRaw(
            `SELECT * FROM public.${config.tabla} WHERE id = $1::uuid AND deleted_at IS NULL`,
            [id],
        );

        if (!rows || rows.length === 0) {
            throw new NotFoundException(
                `Item con ID ${id} no encontrado en ${config.tabla}`,
            );
        }

        return rows[0] as ICatalogoItem;
    }

    /**
     * Crea un nuevo item en el catálogo.
     * Aprovecha los índices únicos parciales para validar duplicados.
     */
    async create(
        tipo: string,
        dto: CreateCatalogoDto,
        userId: string,
    ): Promise<ICatalogoItem> {
        const tipoValido = this.validarTipo(tipo);
        const config = CATALOGOS_CONFIG[tipoValido];

        // Construir campos dinámicamente según el catálogo
        const campos: string[] = ['id', 'nombre', 'created_by', 'updated_by'];
        const valores: any[] = [
            await this.generarUuid(),
            dto.nombre,
            userId,
            userId,
        ];

        // Agregar campos especiales según el catálogo
        if (config.camposEspeciales.includes('abreviatura') && dto.abreviatura) {
            campos.push('abreviatura');
            valores.push(dto.abreviatura);
        }
        if (config.camposEspeciales.includes('descripcion') && dto.descripcion) {
            campos.push('descripcion');
            valores.push(dto.descripcion);
        }
        if (config.camposEspeciales.includes('pais') && dto.pais) {
            campos.push('pais');
            valores.push(dto.pais);
        }
        if (config.camposEspeciales.includes('telefono') && dto.telefono) {
            campos.push('telefono');
            valores.push(dto.telefono);
        }
        if (config.camposEspeciales.includes('email') && dto.email) {
            campos.push('email');
            valores.push(dto.email);
        }

        const placeholders = valores.map((_, i) => `$${i + 1}`).join(', ');
        const query = `
      INSERT INTO public.${config.tabla} (${campos.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

        try {
            const rows = await this.prisma.queryRaw(query, valores);
            this.logger.log(`✅ Creado item en ${config.tabla}: ${dto.nombre}`);
            return rows[0] as ICatalogoItem;
        } catch (error: any) {
            // Capturar error de índice único (PostgreSQL code 23505)
            if (error.code === '23505' || error.message?.includes('duplicate key')) {
                throw new ConflictException(
                    `Ya existe un registro con ese nombre o abreviatura en ${config.tabla}`,
                );
            }
            throw error;
        }
    }

    /**
     * Actualiza un item del catálogo
     */
    async update(
        tipo: string,
        id: string,
        dto: UpdateCatalogoDto,
        userId: string,
    ): Promise<ICatalogoItem> {
        const tipoValido = this.validarTipo(tipo);
        const config = CATALOGOS_CONFIG[tipoValido];

        // Verificar que existe
        await this.findOne(tipo, id);

        const campos: string[] = ['updated_at = CURRENT_TIMESTAMP', 'updated_by = $1'];
        const valores: any[] = [userId];
        let paramIndex = 2;

        if (dto.nombre !== undefined) {
            campos.push(`nombre = $${paramIndex}`);
            valores.push(dto.nombre);
            paramIndex++;
        }
        if (config.camposEspeciales.includes('abreviatura') && dto.abreviatura !== undefined) {
            campos.push(`abreviatura = $${paramIndex}`);
            valores.push(dto.abreviatura);
            paramIndex++;
        }
        if (config.camposEspeciales.includes('descripcion') && dto.descripcion !== undefined) {
            campos.push(`descripcion = $${paramIndex}`);
            valores.push(dto.descripcion);
            paramIndex++;
        }
        if (config.camposEspeciales.includes('pais') && dto.pais !== undefined) {
            campos.push(`pais = $${paramIndex}`);
            valores.push(dto.pais);
            paramIndex++;
        }
        if (config.camposEspeciales.includes('telefono') && dto.telefono !== undefined) {
            campos.push(`telefono = $${paramIndex}`);
            valores.push(dto.telefono);
            paramIndex++;
        }
        if (config.camposEspeciales.includes('email') && dto.email !== undefined) {
            campos.push(`email = $${paramIndex}`);
            valores.push(dto.email);
            paramIndex++;
        }

        valores.push(id);
        const query = `
      UPDATE public.${config.tabla}
      SET ${campos.join(', ')}
      WHERE id = $${paramIndex}::uuid AND deleted_at IS NULL
      RETURNING *
    `;

        try {
            const rows = await this.prisma.queryRaw(query, valores);
            this.logger.log(`✅ Actualizado item en ${config.tabla}: ${id}`);
            return rows[0] as ICatalogoItem;
        } catch (error: any) {
            if (error.code === '23505' || error.message?.includes('duplicate key')) {
                throw new ConflictException(
                    `Ya existe otro registro con ese nombre o abreviatura en ${config.tabla}`,
                );
            }
            throw error;
        }
    }

    /**
     * Soft delete usando la función SQL del equipo de datos
     */
    async remove(tipo: string, id: string, userId: string): Promise<{ mensaje: string }> {
        const tipoValido = this.validarTipo(tipo);
        const config = CATALOGOS_CONFIG[tipoValido];

        // Verificar que existe antes de eliminar
        await this.findOne(tipo, id);

        try {
            const result = await this.prisma.queryRaw<{ filas_afectadas: number; mensaje: string }>(
                `SELECT * FROM soft_delete($1, $2::uuid, $3::uuid)`,
                [config.tabla, id, userId],
            );

            this.logger.log(`🗑️ Soft delete en ${config.tabla}: ${id}`);
            return {
                mensaje: result[0]?.mensaje || `Item eliminado correctamente de ${config.tabla}`,
            };
        } catch (error: any) {
            this.logger.error(`Error en soft_delete: ${error.message}`);
            throw error;
        }
    }

    /**
     * Genera un UUID v4
     */
    private async generarUuid(): Promise<string> {
        const result = await this.prisma.queryRaw<{ uuid: string }>(
            'SELECT gen_random_uuid()::text as uuid',
        );
        return result[0].uuid;
    }
}