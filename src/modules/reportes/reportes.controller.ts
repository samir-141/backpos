import {
  Controller,
  Get,
  Query,
  Headers,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import { QueryReportesDto } from './dto/query-reportes.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@ApiTags('Reportes')
@Controller('reportes')
@UseGuards(TenantGuard, PermissionsGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('ventas')
  @RequirePermissions('reportes.ventas')
  @ApiOperation({
    summary:
      'Obtener reporte financiero de ventas, ganancia bruta real y desglose de cobros',
  })
  getReporteVentas(
    @Request() req: any,
    @Query() query: QueryReportesDto,
    @Headers('x-sucursal-id') sucursalHeader?: string,
  ) {
    const sucursalId = query.sucursal_id || sucursalHeader;
    return this.reportesService.getReporteVentas(req.botica_id, {
      ...query,
      sucursal_id: sucursalId,
    });
  }

  @Get('inventario')
  @RequirePermissions('reportes.inventario')
  @ApiOperation({
    summary:
      'Obtener reporte de valorización de inventario, ABC Analysis y control de vencimientos FEFO',
  })
  getReporteInventario(
    @Request() req: any,
    @Query() query: QueryReportesDto,
    @Headers('x-sucursal-id') sucursalHeader?: string,
  ) {
    const sucursalId = query.sucursal_id || sucursalHeader;
    return this.reportesService.getReporteInventario(req.botica_id, {
      ...query,
      sucursal_id: sucursalId,
    });
  }

  @Get('financiero')
  @RequirePermissions('reportes.financiero')
  @ApiOperation({
    summary:
      'Reporte administrativo de flujo, costos, gastos y capital inmovilizado',
  })
  getReporteFinanciero(@Request() req: any, @Query() query: QueryReportesDto) {
    return this.reportesService.getReporteFinanciero(req.botica_id, query);
  }

  @Get('ple-libro-ventas')
  @RequirePermissions('reportes.ple')
  @ApiOperation({
    summary:
      'Generar archivo plano del Libro de Ventas Electrónico (PLE 14.1 SUNAT)',
  })
  generarLibroVentasPLE(
    @Request() req: any,
    @Query() query: QueryReportesDto,
    @Headers('x-sucursal-id') sucursalHeader?: string,
  ) {
    const sucursalId = query.sucursal_id || sucursalHeader;
    return this.reportesService.generarLibroVentasPLE(req.botica_id, {
      ...query,
      sucursal_id: sucursalId,
    });
  }
}
