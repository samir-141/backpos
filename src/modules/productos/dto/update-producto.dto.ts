// src/modules/productos/dto/update-producto.dto.ts
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductoDto {
  @ApiPropertyOptional({ description: 'Tipo de producto' })
  @IsOptional()
  @IsString()
  tipo_producto?: string;

  @ApiPropertyOptional({ description: 'Atributos: talla, color, modelo, etc.' })
  @IsOptional()
  atributos?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  controla_lote?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiere_vencimiento?: boolean;
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

  @ApiPropertyOptional({
    description: 'Indica si el producto está afecto al IGV (18%)',
  })
  @IsOptional()
  @IsBoolean()
  afecto_igv?: boolean;

  @ApiPropertyOptional({
    description: 'ID de la presentación específica a editar',
  })
  @IsOptional()
  @IsString()
  presentacion_id?: string;

  @ApiPropertyOptional({ description: 'Registro sanitario DIGEMID' })
  @IsOptional()
  @IsString()
  registro_sanitario?: string;

  @ApiPropertyOptional({ description: 'Nombre comercial del producto' })
  @IsOptional()
  @IsString()
  nombre_comercial?: string;
}
