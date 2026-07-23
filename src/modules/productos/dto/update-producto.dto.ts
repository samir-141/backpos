// src/modules/productos/dto/update-producto.dto.ts
import { IsOptional, IsString, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductoDto {
    @ApiPropertyOptional({ description: 'Precio actual de venta (con IGV)' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    precio_actual?: number;

    @ApiPropertyOptional({ description: 'Código de barras del producto' })
    @IsOptional()
    @IsString()
    codigo_barras?: string;

    @ApiPropertyOptional({ description: 'Indica si requiere receta médica' })
    @IsOptional()
    @IsBoolean()
    requiere_receta?: boolean;

    @ApiPropertyOptional({ description: 'Indica si el producto está afecto al IGV (18%)' })
    @IsOptional()
    @IsBoolean()
    afecto_igv?: boolean;

    @ApiPropertyOptional({ description: 'ID de la presentación específica a editar' })
    @IsOptional()
    @IsString()
    presentacion_id?: string;
}
