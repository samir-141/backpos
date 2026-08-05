import {
  Controller,
  Get,
  Query,
  Headers,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { TenantGuard } from '../../auth/guards/tenant.guard';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumen')
  @ApiOperation({
    summary:
      'Obtener métricas clave de dashboard (KPIs del día, gráfico de 7 días, alertas y ventas top)',
  })
  getResumen(
    @Request() req: any,
    @Query() query: Record<string, any>,
    @Headers('x-sucursal-id') sucursalHeader?: string,
  ) {
    const sucursalId = query.sucursal_id || sucursalHeader;
    const rango = query.rango || query.RANGO || 'HOY';
    return this.dashboardService.getResumen(req.botica_id, {
      ...query,
      rango: String(rango),
      sucursal_id: sucursalId ? String(sucursalId) : undefined,
    });
  }
}
