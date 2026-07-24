import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryClientesDto {
    @ApiPropertyOptional({ description: 'Página actual', default: 1, minimum: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items por página', default: 20, minimum: 1, maximum: 100 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Buscar por nombre, documento, teléfono o email' })
    @IsString()
    @IsOptional()
    buscar?: string;

    @ApiPropertyOptional({ description: 'Filtrar por tipo de documento (DNI, RUC, CE, PASAPORTE)' })
    @IsString()
    @IsOptional()
    tipo_documento?: string;
}
