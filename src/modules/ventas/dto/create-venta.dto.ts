import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DatosClienteDto {
  @ApiProperty()
  @IsString()
  tipo_documento: string;

  @ApiProperty()
  @IsString()
  numero_documento: string;

  @ApiProperty()
  @IsString()
  nombre_razon_social: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string;
}

export class DetalleVentaItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  producto_comercial_id: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  presentacion_nombre: string;

  @ApiProperty({ description: 'ID de la presentación seleccionada en el POS' })
  @IsUUID()
  producto_presentacion_id: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  cantidad: number;

  @ApiPropertyOptional({
    description:
      'Valor informativo legado. El backend usa precio_actual de la presentación.',
  })
  @IsOptional()
  @IsNumber()
  precio_unitario?: number;
}

export class CreateVentaDto {
  @ApiPropertyOptional({
    description:
      'UUID estable por intento de venta. Temporalmente opcional para clientes antiguos; sin él no hay garantía de reintento.',
  })
  @IsOptional()
  @IsUUID()
  idempotency_key?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  tipo_comprobante: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  tipo_pago: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  metodo_pago: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  monto_recibido?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  vuelto?: number;

  @ApiPropertyOptional({ type: DatosClienteDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DatosClienteDto)
  datos_cliente?: DatosClienteDto;

  @ApiPropertyOptional({
    description: 'Valor informativo; el backend lo recalcula.',
  })
  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @ApiPropertyOptional({
    description: 'Valor informativo; el backend lo recalcula.',
  })
  @IsOptional()
  @IsNumber()
  igv?: number;

  @ApiPropertyOptional({
    description: 'Valor informativo; el backend lo recalcula.',
  })
  @IsOptional()
  @IsNumber()
  total?: number;

  @ApiProperty({ type: [DetalleVentaItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleVentaItemDto)
  items: DetalleVentaItemDto[];
}
