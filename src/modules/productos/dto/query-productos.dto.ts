// src/modules/productos/dto/query-productos.dto.ts
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum OrdenProductos {
    NOMBRE_ASC = 'nombre_asc',
    NOMBRE_DESC = 'nombre_desc',
    PRECIO_ASC = 'precio_asc',
    PRECIO_DESC = 'precio_desc',
    STOCK_ASC = 'stock_asc',
    STOCK_DESC = 'stock_desc',
}

export class QueryProductosDto {
    @ApiPropertyOptional({ description: 'Página actual', default: 1, minimum: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items por página', default: 20, minimum: 1, maximum: 100 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Buscar por nombre comercial, SKU o código de barras' })
    @IsString()
    @IsOptional()
    buscar?: string;

    @ApiPropertyOptional({ description: 'Filtrar por ID de laboratorio' })
    @IsUUID()
    @IsOptional()
    laboratorio_id?: string;

    @ApiPropertyOptional({ description: 'Filtrar por ID de categoría' })
    @IsUUID()
    @IsOptional()
    categoria_id?: string;

    @ApiPropertyOptional({ description: 'Filtrar por ID de principio activo' })
    @IsUUID()
    @IsOptional()
    principio_activo_id?: string;

    @ApiPropertyOptional({ description: 'Filtrar productos por ID de sucursal' })
    @IsUUID()
    @IsOptional()
    sucursal_id?: string;

    @ApiPropertyOptional({
        description: 'Ordenamiento',
        enum: OrdenProductos,
        default: OrdenProductos.NOMBRE_ASC,
    })
    @IsEnum(OrdenProductos)
    @IsOptional()
    orden?: OrdenProductos = OrdenProductos.NOMBRE_ASC;

}