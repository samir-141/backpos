import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryReportesDto {
    @ApiPropertyOptional({ description: 'ID de sucursal para filtrar los reportes' })
    @IsUUID()
    @IsOptional()
    sucursal_id?: string;

    @ApiPropertyOptional({ description: 'Fecha de inicio en formato YYYY-MM-DD' })
    @IsString()
    @IsOptional()
    fecha_inicio?: string;

    @ApiPropertyOptional({ description: 'Fecha de fin en formato YYYY-MM-DD' })
    @IsString()
    @IsOptional()
    fecha_fin?: string;

    @ApiPropertyOptional({ description: 'Filtrar por tipo de comprobante (BOLETA, FACTURA, NOTA_VENTA)' })
    @IsString()
    @IsOptional()
    tipo_comprobante?: string;
}
