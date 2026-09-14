import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestAutenticada } from '../../../auth/interfaces/request-autenticada.interface';
import { TenantGuard } from '../../../auth/guards/tenant.guard';
import { TaxEngineService } from '../services/tax-engine.service';
import { ConsolidationService } from '../services/consolidation.service';
import { EvaluateSaleTaxDto } from '../dto/evaluate-sale-tax.dto';
import { ConsolidateDailySalesDto } from '../dto/consolidate-daily-sales.dto';

@ApiTags('Tax Engine (Motor Tributario SUNAT)')
@Controller('tax-engine')
@UseGuards(TenantGuard)
export class TaxEngineController {
  constructor(
    private readonly taxEngine: TaxEngineService,
    private readonly consolidation: ConsolidationService,
  ) {}

  @Post('evaluate-sale')
  @ApiOperation({
    summary:
      'Evalúa las reglas tributarias de SUNAT en tiempo real para una venta',
  })
  evaluateSale(
    @Request() req: RequestAutenticada,
    @Body() dto: EvaluateSaleTaxDto,
  ) {
    return this.taxEngine.evaluateSale(req.botica_id, dto);
  }

  @Get('status')
  @ApiOperation({
    summary:
      'Obtiene el estado de conexión del motor tributario y cola de sincronización',
  })
  getStatus(@Request() req: RequestAutenticada) {
    return this.taxEngine.getEngineStatus(req.botica_id);
  }

  @Get('consolidados/pendientes')
  @ApiOperation({
    summary:
      'Lista ventas menores a S/ 5.00 pendientes de consolidación para una caja',
  })
  getPendingConsolidated(
    @Request() req: RequestAutenticada,
    @Query('cajaId') cajaId: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.consolidation.getPendingSubFiveSales(
      req.botica_id,
      cajaId,
      fecha,
    );
  }

  @Post('consolidados/generar')
  @ApiOperation({
    summary: 'Genera el consolidado diario de ventas menores a S/ 5.00',
  })
  generateConsolidated(
    @Request() req: RequestAutenticada,
    @Body() dto: ConsolidateDailySalesDto,
  ) {
    const usuarioId = req.user?.id || '00000000-0000-0000-0000-000000000000';
    return this.consolidation.consolidateDailySales(
      req.botica_id,
      dto,
      usuarioId,
    );
  }
}
