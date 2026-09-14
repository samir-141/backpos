import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const REGIMENES = [
  'NRUS',
  'NUEVO_RUS',
  'RER',
  'MYPE',
  'RMT',
  'GENERAL',
  'OTRO',
] as const;
const TIPOS_CONTRIBUYENTE = ['PERSONA_NATURAL', 'PERSONA_JURIDICA'] as const;

export class CreatePerfilTributarioDto {
  @ApiProperty({ description: 'RUC de 11 dígitos' })
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos' })
  ruc: string;

  @ApiProperty({ description: 'Razón Social' })
  @IsString()
  @MaxLength(200)
  razon_social: string;

  @ApiPropertyOptional({ description: 'Nombre Comercial' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(200)
  nombre_comercial?: string;

  @ApiProperty({ enum: TIPOS_CONTRIBUYENTE, default: 'PERSONA_NATURAL' })
  @IsIn(TIPOS_CONTRIBUYENTE)
  tipo_contribuyente: string;

  @ApiProperty({ enum: REGIMENES, default: 'NRUS' })
  @IsIn(REGIMENES)
  regimen_tributario: string;

  @ApiProperty({ description: 'Dirección fiscal' })
  @IsString()
  @MaxLength(250)
  direccion_fiscal: string;

  @ApiPropertyOptional({ description: 'Ubigeo de 6 dígitos' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @ValidateIf((o) => typeof o.ubigeo === 'string' && o.ubigeo.trim().length > 0)
  @Matches(/^\d{6}$/, { message: 'El ubigeo debe tener 6 dígitos' })
  ubigeo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(100)
  departamento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(100)
  provincia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(100)
  distrito?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  es_principal?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
