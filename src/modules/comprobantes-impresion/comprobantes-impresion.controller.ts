// src/modules/comprobantes-impresion/comprobantes-impresion.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Public } from '../../auth/decorators/public.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ComprobantesImpresionService } from './comprobantes-impresion.service';
import { ImprimirComprobanteDto } from './dto/imprimir-comprobante.dto';

@ApiTags('Comprobantes Impresión')
@Controller('comprobantes')
export class ComprobantesImpresionController {
  constructor(
    private readonly impresionService: ComprobantesImpresionService,
  ) {}

  @Post('venta/:ventaId/imprimir')
  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermissions('comprobantes.imprimir')
  @ApiOperation({
    summary: 'Generar representación impresa temporal (PDF) de una venta',
  })
  async imprimir(
    @Param('ventaId', new ParseUUIDPipe({ version: '4' })) ventaId: string,
    @Body() dto: ImprimirComprobanteDto,
    @Request() req: any,
  ) {
    const filename = await this.impresionService.generarImpresionPdf(
      ventaId,
      dto.formato,
      req.botica_id,
    );
    return {
      success: true,
      url: `/api/comprobantes/temp/${filename}`,
    };
  }

  @Post('venta/:ventaId/diagnostico')
  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermissions('comprobantes.imprimir')
  @ApiOperation({
    summary:
      'Diagnóstico de impresión — muestra en consola los datos de la venta y la empresa',
  })
  async diagnostico(
    @Param('ventaId', new ParseUUIDPipe({ version: '4' })) ventaId: string,
    @Request() req: any,
  ) {
    const resultado = await this.impresionService.depurarImpresion(
      ventaId,
      req.botica_id,
    );
    return { success: true, diagnostico: resultado };
  }

  @Get('botica/:boticaId')
  @UseGuards(TenantGuard, PermissionsGuard)
  @RequirePermissions('comprobantes.imprimir')
  @ApiOperation({ summary: 'Obtener datos de una botica por ID' })
  async obtenerBotica(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Request() req: any,
  ) {
    const botica = await this.impresionService.obtenerBotica(
      boticaId,
      req.botica_id,
    );
    return { success: true, data: botica };
  }

  @Public()
  @Get('temp/:filename')
  @ApiOperation({ summary: 'Descargar representación impresa temporal' })
  async descargarTemporal(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const buffer = await this.impresionService.obtenerArchivoTemporal(filename);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
