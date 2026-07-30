import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClienteDto {
  @ApiProperty({
    description: 'Tipo de documento (DNI, RUC, CE, PASAPORTE)',
    default: 'DNI',
  })
  @IsNotEmpty()
  @IsString()
  tipo_documento: string;

  @ApiProperty({ description: 'Número de documento de identidad' })
  @IsNotEmpty()
  @IsString()
  numero_documento: string;

  @ApiProperty({ description: 'Nombre completo o Razón social del cliente' })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ description: 'Dirección del cliente' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ description: 'Número de teléfono o celular' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ description: 'Correo electrónico' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Tipo de cliente (NATURAL, JURIDICO, HOSPITAL, CLINICA, DROGUERIA, BOTICA, OTRO)',
    default: 'NATURAL',
  })
  @IsOptional()
  @IsString()
  tipo_cliente?: string;

  @ApiPropertyOptional({
    description:
      'Condición del contribuyente en SUNAT (HABIDO, NO HABIDO, SUSPENDED, ANULADO)',
    default: 'HABIDO',
  })
  @IsOptional()
  @IsString()
  condicion_contribuyente?: string;

  @ApiPropertyOptional({
    description:
      'Estado del contribuyente en SUNAT (ACTIVO, BAJA DE OFICIO, etc.)',
  })
  @IsOptional()
  @IsString()
  estado_sunat?: string;

  @ApiPropertyOptional({
    description: 'Estado del cliente en el ERP (ACTIVO, INACTIVO, BLOQUEADO)',
    default: 'ACTIVO',
  })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional({
    description: 'Límite de crédito asignado (S/)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limite_credito?: number;

  @ApiPropertyOptional({
    description: 'Días de plazo de crédito (30, 60, 90 días)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dias_credito?: number;

  @ApiPropertyOptional({
    description: 'Saldo actual pendiente de pago (S/)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  saldo_actual?: number;

  @ApiPropertyOptional({
    description: 'Estado crediticio (AL CORRIENTE, MOROSO, BLOQUEADO)',
    default: 'AL CORRIENTE',
  })
  @IsOptional()
  @IsString()
  estado_credito?: string;

  @ApiPropertyOptional({ description: 'Número de WhatsApp de contacto' })
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional({
    description: 'Nombre de la persona de contacto principal (B2B)',
  })
  @IsOptional()
  @IsString()
  contacto_principal?: string;

  @ApiPropertyOptional({ description: 'Cargo de la persona de contacto' })
  @IsOptional()
  @IsString()
  cargo_contacto?: string;

  @ApiPropertyOptional({
    description: 'Representante legal (para RUC / Persona Jurídica)',
  })
  @IsOptional()
  @IsString()
  representante_legal?: string;

  @ApiPropertyOptional({ description: 'DNI del representante legal' })
  @IsOptional()
  @IsString()
  dni_representante?: string;

  @ApiPropertyOptional({ description: 'Fecha de nacimiento' })
  @IsOptional()
  @IsString()
  fecha_nacimiento?: string;

  @ApiPropertyOptional({ description: 'Observaciones internas o notas' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({
    description: 'Origen del cliente (web, recomendacion, etc.)',
  })
  @IsOptional()
  @IsString()
  origen?: string;
}
