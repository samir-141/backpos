// src/modules/catalogos/dto/create-catalogo.dto.ts
import { IsString, IsOptional, IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCatalogoDto {
    @ApiProperty({ description: 'Nombre del catálogo', example: 'Paracetamol' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    nombre: string;

    @ApiPropertyOptional({ description: 'Abreviatura (solo unidades de presentación)', example: 'mg' })
    @IsString()
    @IsOptional()
    @MaxLength(10)
    abreviatura?: string;

    @ApiPropertyOptional({ description: 'Descripción (solo principios activos)', example: 'Analgésico antipirético' })
    @IsString()
    @IsOptional()
    descripcion?: string;

    @ApiPropertyOptional({ description: 'País (solo laboratorios)', example: 'Alemania' })
    @IsString()
    @IsOptional()
    @MaxLength(50)
    pais?: string;

    @ApiPropertyOptional({ description: 'Teléfono (solo laboratorios)', example: '+51 1 2345678' })
    @IsString()
    @IsOptional()
    @MaxLength(20)
    telefono?: string;

    @ApiPropertyOptional({ description: 'Email (solo laboratorios)', example: 'contacto@bayer.com' })
    @IsEmail()
    @IsOptional()
    @MaxLength(100)
    email?: string;
}