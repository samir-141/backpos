import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import { QueryReportesDto } from './dto/query-reportes.dto';

@ApiTags('Reportes')
@Controller('reportes')
export class ReportesController {
    constructor(private readonly reportesService: ReportesService) { }

    @Get('ventas')
    @ApiOperation({ summary: 'Obtener reporte financiero de ventas y desglose de cobros' })
    getReporteVentas(
        @Query() query: QueryReportesDto,
        @Headers('x-sucursal-id') sucursalHeader?: string
    ) {
        const sucursalId = query.sucursal_id || sucursalHeader;
        return this.reportesService.getReporteVentas({ ...query, sucursal_id: sucursalId });
    }

    @Get('inventario')
    @ApiOperation({ summary: 'Obtener reporte de valorización de inventario y control de vencimientos FEFO' })
    getReporteInventario(
        @Query() query: QueryReportesDto,
        @Headers('x-sucursal-id') sucursalHeader?: string
    ) {
        const sucursalId = query.sucursal_id || sucursalHeader;
        return this.reportesService.getReporteInventario({ ...query, sucursal_id: sucursalId });
    }
}
