import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SolBotItemDto {
  @ApiProperty({ example: 'BIEN', enum: ['BIEN', 'SERVICIO'] })
  @IsEnum(['BIEN', 'SERVICIO'])
  tipo: 'BIEN' | 'SERVICIO';

  @ApiPropertyOptional({ example: 'PROD-001' })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiProperty({ example: 'Paracetamol 500mg' })
  @IsNotEmpty()
  @IsString()
  descripcion: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  cantidad: number;

  @ApiProperty({ example: 1.5 })
  @IsNumber()
  precioUnitario: number;
}

export class SolBotReceptorDto {
  @ApiPropertyOptional({
    example: '1',
    description: '1: DNI, 6: RUC, 4: Carnet Extr, 0: Sin documento (dejar vacío para clientes varios)',
  })
  @IsOptional()
  @IsString()
  tipoDoc?: string;

  @ApiPropertyOptional({ example: '72345678' })
  @IsOptional()
  @IsString()
  numeroDoc?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  razonSocialODatos?: string;
}

export class SolBotEmitirBoletaDto {
  @ApiPropertyOptional({
    type: SolBotReceptorDto,
    description: 'Datos del cliente. Si se omite o se manda vacío, se emite boleta sin datos / clientes varios (< S/ 700)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SolBotReceptorDto)
  receptor?: SolBotReceptorDto;

  @ApiProperty({ type: [SolBotItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SolBotItemDto)
  items: SolBotItemDto[];

  @ApiPropertyOptional({ example: 'Venta rápida farmacia' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Ejecutar navegador en modo invisible',
  })
  @IsOptional()
  headless?: boolean;
}
