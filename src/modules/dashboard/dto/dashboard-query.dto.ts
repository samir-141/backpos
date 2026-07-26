import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardQueryDto {
    @ApiPropertyOptional({ description: 'ID de la sucursal a consultar' })
    @IsString()
    @IsOptional()
    sucursal_id?: string;

    @ApiPropertyOptional({ description: 'Rango predeterminado (HOY, AYER, 7DIAS, MES, CUSTOM)' })
    @IsString()
    @IsOptional()
    rango?: string;

    @ApiPropertyOptional({ description: 'Fecha de inicio (YYYY-MM-DD)' })
    @IsString()
    @IsOptional()
    fecha_inicio?: string;

    @ApiPropertyOptional({ description: 'Fecha de fin (YYYY-MM-DD)' })
    @IsString()
    @IsOptional()
    fecha_fin?: string;
}
