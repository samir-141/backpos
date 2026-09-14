import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCatalogoMaestroDto {
  @ApiProperty({ description: 'Código de barras único del producto (EAN/UPC)' })
  @IsString()
  @IsNotEmpty()
  codigo_barras: string;

  @ApiPropertyOptional({ description: 'SKU sugerido' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({ description: 'Nombre comercial del producto' })
  @IsString()
  @IsNotEmpty()
  nombre_comercial: string;

  @ApiPropertyOptional({
    description: 'Tipo de producto',
    default: 'MEDICAMENTO',
  })
  @IsString()
  @IsOptional()
  tipo_producto?: string;

  @ApiPropertyOptional({ description: 'Nombre del principio activo' })
  @IsString()
  @IsOptional()
  principio_activo?: string;

  @ApiPropertyOptional({ description: 'Concentración (ej. 500)' })
  @IsString()
  @IsOptional()
  concentracion?: string;

  @ApiPropertyOptional({
    description: 'Unidad de concentración (ej. mg, ml, g)',
    default: 'mg',
  })
  @IsString()
  @IsOptional()
  unidad_concentracion?: string;

  @ApiPropertyOptional({
    description: 'Forma farmacéutica (ej. Tableta, Jarabe, Suspensión)',
  })
  @IsString()
  @IsOptional()
  forma_farmaceutica?: string;

  @ApiPropertyOptional({
    description: 'Vía de administración',
    default: 'Oral',
  })
  @IsString()
  @IsOptional()
  via_administracion?: string;

  @ApiPropertyOptional({
    description: '¿Requiere receta médica?',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requiere_receta?: boolean;

  @ApiPropertyOptional({ description: '¿Afecto al IGV?', default: true })
  @IsBoolean()
  @IsOptional()
  afecto_igv?: boolean;

  @ApiPropertyOptional({ description: 'Laboratorio o fabricante' })
  @IsString()
  @IsOptional()
  laboratorio?: string;

  @ApiPropertyOptional({ description: 'Categoría o acción terapéutica' })
  @IsString()
  @IsOptional()
  categoria?: string;

  @ApiPropertyOptional({ description: 'Registro sanitario' })
  @IsString()
  @IsOptional()
  registro_sanitario?: string;

  @ApiPropertyOptional({
    description: 'Unidad de presentación (ej. Caja, Frasco, Blíster)',
    default: 'Caja',
  })
  @IsString()
  @IsOptional()
  unidad_presentacion?: string;

  @ApiPropertyOptional({
    description: 'Unidad base de consumo (ej. Unidad, Tableta, ml)',
    default: 'Unidad',
  })
  @IsString()
  @IsOptional()
  unidad_base?: string;

  @ApiPropertyOptional({
    description: 'Cantidad de unidades base por presentación',
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  cantidad_unidad_base?: number;

  @ApiPropertyOptional({ description: 'Controla lote', default: true })
  @IsBoolean()
  @IsOptional()
  controla_lote?: boolean;

  @ApiPropertyOptional({ description: 'Requiere vencimiento', default: true })
  @IsBoolean()
  @IsOptional()
  requiere_vencimiento?: boolean;

  @ApiPropertyOptional({ description: 'URL de imagen del empaque' })
  @IsString()
  @IsOptional()
  foto_url?: string;
}
