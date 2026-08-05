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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { ComprobantesImpresionService } from './comprobantes-impresion.service';
import { ImprimirComprobanteDto } from './dto/imprimir-comprobante.dto';

@ApiTags('Comprobantes Impresión')
@Controller('comprobantes')
export class ComprobantesImpresionController {
  constructor(
    private readonly impresionService: ComprobantesImpresionService,
  ) {}

  @Post('venta/:ventaId/imprimir')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
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
