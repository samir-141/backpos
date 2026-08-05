import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const AMBIENTES = ['BETA', 'PRODUCCION'] as const;
const REGIMENES = ['NUEVO_RUS', 'RER', 'MYPE', 'GENERAL'] as const;

export class GuardarConfiguracionTributariaDto {
  @ApiProperty({ description: 'RUC de 11 dígitos' })
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener 11 dígitos' })
  ruc: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  razonSocial: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombreComercial?: string;

  @ApiPropertyOptional({ description: 'Ubigeo INEI de 6 dígitos' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'El ubigeo debe tener 6 dígitos' })
  ubigeo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  departamento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provincia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  distrito?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(250)
  direccionFiscal: string;

  @ApiProperty({ enum: REGIMENES })
  @IsIn(REGIMENES)
  regimenTributario: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emisorElectronico?: boolean;

  @ApiPropertyOptional({ enum: AMBIENTES, default: 'BETA' })
  @IsOptional()
  @IsIn(AMBIENTES)
  ambiente?: string;

  /** Usuario SOL secundario (p.ej. MODDATOS). Se almacena cifrado. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  solUsuario?: string;

  /** Clave SOL. Se almacena cifrada y nunca se devuelve. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  solClave?: string;

  /** Contraseña del certificado .pfx/.p12. Se almacena cifrada. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  certificadoClave?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
