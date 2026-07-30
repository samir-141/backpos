import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSerieDocumentoDto {
  @ApiProperty({ example: 'BOLETA', enum: ['BOLETA', 'FACTURA', 'NOTA_VENTA', 'GUIA_REMISION'] })
  @IsIn(['BOLETA', 'FACTURA', 'NOTA_VENTA', 'GUIA_REMISION'])
  tipo_documento: string;

  @ApiProperty({ example: 'B001' })
  @IsString()
  serie: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  correlativo_inicial?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  correlativo_actual?: number;

  @ApiProperty({ example: 8, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  longitud_correlativo?: number;

  @ApiProperty({ example: 'uuid-of-sucursal', required: false })
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsUUID()
  sucursal_id?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
