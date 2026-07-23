// src/modules/productos/dto/create-producto.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsUUID, IsNumber, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductoDto {
    @ApiPropertyOptional({ description: 'ID del producto comercial existente si ya existe y solo se agrega una presentación' })
    @IsOptional()
    @IsUUID()
    producto_comercial_id?: string;

    @ApiProperty({ description: 'Nombre comercial del producto' })
    @IsOptional()
    @IsString()
    nombre_comercial?: string;

    @ApiProperty({ description: 'Código SKU único' })
    @IsOptional()
    @IsString()
    sku?: string;

    @ApiPropertyOptional({ description: 'Código interno opcional' })
    @IsOptional()
    @IsString()
    codigo_interno?: string;

    @ApiProperty({ description: 'ID del catálogo de principios activos' })
    @IsOptional()
    @IsUUID()
    principio_activo_id?: string;

    @ApiProperty({ description: 'ID del catálogo de formas farmacéuticas' })
    @IsOptional()
    @IsUUID()
    forma_farmaceutica_id?: string;

    @ApiProperty({ description: 'ID del catálogo de laboratorios' })
    @IsOptional()
    @IsUUID()
    laboratorio_id?: string;

    @ApiProperty({ description: 'ID del catálogo de categorías' })
    @IsOptional()
    @IsUUID()
    categoria_id?: string;

    @ApiProperty({ description: 'Concentración numérica' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    concentracion?: number;

    @ApiProperty({ description: 'Unidad de concentración (ej: mg, ml)' })
    @IsOptional()
    @IsString()
    unidad_concentracion?: string;

    @ApiProperty({ description: 'Vía de administración' })
    @IsOptional()
    @IsString()
    via_administracion?: string;

    @ApiProperty({ description: 'Indica si requiere receta médica' })
    @IsOptional()
    @IsBoolean()
    requiere_receta?: boolean;

    @ApiProperty({ description: 'Indica si el producto está afecto al IGV (18%)' })
    @IsOptional()
    @IsBoolean()
    afecto_igv?: boolean;

    @ApiProperty({ description: 'ID del catálogo de unidades de presentación' })
    @IsNotEmpty()
    @IsUUID()
    presentacion_id: string;

    @ApiProperty({ description: 'Cantidad de unidades base contenidas en el pack (ej: 100 para caja)' })
    @IsNotEmpty()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    cantidad_unidad_base: number;

    @ApiProperty({ description: 'Precio actual de venta (con IGV)' })
    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    precio_actual: number;

    @ApiPropertyOptional({ description: 'Código de barras del producto' })
    @IsOptional()
    @IsString()
    codigo_barras?: string;
}
