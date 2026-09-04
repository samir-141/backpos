import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const SISTEMAS_EMISION = [
  'SEE_SOL',
  'SEE_CONTRIBUYENTE',
  'SEE_CF',
  'FACTURADOR_SUNAT',
  'PSE',
  'OSE',
  'MANUAL',
] as const;

const AMBIENTES = ['BETA', 'PRODUCCION'] as const;

export class GuardarConfigEmisionDto {
  @ApiPropertyOptional({ enum: SISTEMAS_EMISION, default: 'SEE_CONTRIBUYENTE' })
  @IsOptional()
  @IsIn(SISTEMAS_EMISION)
  sistema_emision?: string;

  @ApiPropertyOptional({ default: 'SUNAT_DIRECTO' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  proveedor_tipo?: string;

  @ApiPropertyOptional({ enum: AMBIENTES, default: 'BETA' })
  @IsOptional()
  @IsIn(AMBIENTES)
  ambiente?: string;

  @ApiPropertyOptional({ description: 'Usuario SOL' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sol_usuario?: string;

  @ApiPropertyOptional({ description: 'Clave SOL' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  sol_clave?: string;

  @ApiPropertyOptional({ description: 'Contraseña del certificado digital' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  certificado_clave?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pse_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ose_id?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
