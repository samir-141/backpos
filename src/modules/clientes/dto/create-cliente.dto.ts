import { IsNotEmpty, IsString, IsOptional, IsEmail, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClienteDto {
    @ApiProperty({ description: 'Tipo de documento (DNI, RUC, CE, PASAPORTE)', default: 'DNI' })
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
}
