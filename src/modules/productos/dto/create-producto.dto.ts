// src/modules/productos/dto/create-producto.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PresentacionProductoDto {
  @IsUUID()
  unidad_presentacion_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad_unidad_base: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_actual: number;

  @IsOptional()
  @IsString()
  codigo_barras?: string;
}

export class CreateProductoDto {
  @ApiPropertyOptional({ enum: ['MEDICAMENTO', 'HIGIENE', 'BEBE', 'COSMETICO', 'ACCESORIO', 'OTRO'] })
  @IsOptional()
  @IsString()
  tipo_producto?: string;

  @ApiPropertyOptional({ description: 'Indica si el producto se controla por lotes' })
  @IsOptional()
  @IsBoolean()
  controla_lote?: boolean;

  @ApiPropertyOptional({ description: 'Indica si se registra vencimiento al ingresar stock' })
  @IsOptional()
  @IsBoolean()
  requiere_vencimiento?: boolean;

  @ApiPropertyOptional({ description: 'Atributos del producto general: talla, color, modelo, etc.' })
  @IsOptional()
  atributos?: Record<string, string>;
  @ApiPropertyOptional({
    description:
      'ID del producto comercial existente si ya existe y solo se agrega una presentación',
  })
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
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
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  principio_activo_id?: string;

  @ApiProperty({ description: 'ID del catálogo de formas farmacéuticas' })
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  forma_farmaceutica_id?: string;

  @ApiProperty({ description: 'ID del catálogo de laboratorios' })
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  laboratorio_id?: string;

  @ApiProperty({ description: 'ID del catálogo de categorías' })
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
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

  @ApiProperty({
    description: 'Indica si el producto está afecto al IGV (18%)',
  })
  @IsOptional()
  @IsBoolean()
  afecto_igv?: boolean;

  @ApiProperty({ description: 'ID del catálogo de unidades de presentación' })
  @IsNotEmpty()
  @IsUUID()
  presentacion_id: string;

  @ApiPropertyOptional({ description: 'Unidad mínima del inventario; debe tener equivalencia 1' })
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  unidad_base_id?: string;

  @ApiPropertyOptional({ type: [PresentacionProductoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PresentacionProductoDto)
  presentaciones?: PresentacionProductoDto[];

  @ApiProperty({
    description:
      'Cantidad de unidades base contenidas en el pack (ej: 100 para caja)',
  })
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

  @ApiPropertyOptional({ description: 'Registro sanitario DIGEMID' })
  @IsOptional()
  @IsString()
  registro_sanitario?: string;
}
