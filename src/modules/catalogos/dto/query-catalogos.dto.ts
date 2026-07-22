// src/modules/catalogos/dto/query-catalogos.dto.ts
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryCatalogosDto {
    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Buscar por nombre' })
    @IsString()
    @IsOptional()
    buscar?: string;

    @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
    @IsString()
    @IsOptional()
    orden?: 'asc' | 'desc' = 'asc';
}