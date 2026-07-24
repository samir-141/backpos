import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('resumen')
    @ApiOperation({ summary: 'Obtener métricas clave de dashboard (KPIs del día, gráfico de 7 días, alertas y ventas top)' })
    getResumen(
        @Query() query: DashboardQueryDto,
        @Headers('x-sucursal-id') sucursalHeader?: string
    ) {
        const sucursalId = query.sucursal_id || sucursalHeader;
        return this.dashboardService.getResumen({ ...query, sucursal_id: sucursalId });
    }
}
