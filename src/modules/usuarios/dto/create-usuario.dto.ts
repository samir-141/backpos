import { IsNotEmpty, IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUsuarioDto {
    @ApiProperty({ description: 'Nombre completo del usuario' })
    @IsNotEmpty()
    @IsString()
    nombre: string;

    @ApiProperty({ description: 'Correo electrónico único para el inicio de sesión' })
    @IsNotEmpty()
    @IsEmail()
    correo: string;

    @ApiProperty({ description: 'Contraseña de acceso' })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ description: 'ID del Rol asignado' })
    @IsNotEmpty()
    @IsString()
    rol_id: string;

    @ApiPropertyOptional({ description: 'Estado del usuario (ACTIVO / INACTIVO)', default: 'ACTIVO' })
    @IsOptional()
    @IsString()
    estado?: string;
}
