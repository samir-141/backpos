import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Request,
  UseGuards,
  ParseUUIDPipe,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import type { RequestAutenticada } from '../../../auth/interfaces/request-autenticada.interface';
import { FacturacionService } from '../services/facturacion.service';
import { EmitirComprobanteDto } from '../dtos/emitir-comprobante.dto';
import { TenantGuard } from '../../../auth/guards/tenant.guard';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';

@ApiTags('Facturación Electrónica')
@Controller('facturacion')
@UseGuards(TenantGuard, PermissionsGuard)
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  @Post('emitir')
  @RequirePermissions('facturacion.emitir')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Emitir comprobante electrónico (boleta/factura) desde una venta',
  })
  emitir(
    @Body() dto: EmitirComprobanteDto,
    @Request() req: RequestAutenticada,
    @Headers('x-sucursal-id') sucursalId?: string,
  ) {
    return this.facturacionService.emitir(
      dto,
      req.botica_id,
      sucursalId,
      req.user.id,
    );
  }

  @Get('comprobantes')
  @RequirePermissions('facturacion.ver')
  @ApiOperation({ summary: 'Historial de comprobantes electrónicos' })
  listar(
    @Request() req: RequestAutenticada,
    @Query('estado') estado?: string,
    @Query('tipo') tipo?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Headers('x-sucursal-id') sucursalId?: string,
  ) {
    return this.facturacionService.listar(req.botica_id, {
      estado,
      tipo,
      sucursalId,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined,
    });
  }

  @Get('comprobantes/:id')
  @RequirePermissions('facturacion.ver')
  @ApiOperation({ summary: 'Detalle de un comprobante electrónico' })
  detalle(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestAutenticada,
  ) {
    return this.facturacionService.detalle(id, req.botica_id);
  }

  @Post('comprobantes/:id/enviar')
  @RequirePermissions('facturacion.enviar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar (o reanudar envío) del comprobante a SUNAT',
  })
  enviar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestAutenticada,
  ) {
    return this.facturacionService.reintentar(id, req.botica_id, req.user.id);
  }

  @Post('comprobantes/:id/reintentar')
  @RequirePermissions('facturacion.enviar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reintentar envío (mismo correlativo y artefactos)',
  })
  reintentar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestAutenticada,
  ) {
    return this.facturacionService.reintentar(id, req.botica_id, req.user.id);
  }

  @Get('comprobantes/:id/xml')
  @RequirePermissions('facturacion.ver')
  @ApiOperation({ summary: 'Descargar XML firmado' })
  async xml(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestAutenticada,
    @Res() res: Response,
  ) {
    const archivo = await this.facturacionService.descargarArchivo(
      id,
      req.botica_id,
      'xml',
    );
    this.enviarArchivo(res, archivo);
  }

  @Get('comprobantes/:id/cdr')
  @RequirePermissions('facturacion.ver')
  @ApiOperation({ summary: 'Descargar XML de la CDR (constancia SUNAT)' })
  async cdr(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestAutenticada,
    @Res() res: Response,
  ) {
    const archivo = await this.facturacionService.descargarArchivo(
      id,
      req.botica_id,
      'cdr',
    );
    this.enviarArchivo(res, archivo);
  }

  @Get('comprobantes/:id/pdf')
  @RequirePermissions('facturacion.ver')
  @ApiOperation({ summary: 'Descargar representación impresa (PDF)' })
  async pdf(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestAutenticada,
    @Res() res: Response,
  ) {
    const archivo = await this.facturacionService.descargarArchivo(
      id,
      req.botica_id,
      'pdf',
    );
    this.enviarArchivo(res, archivo);
  }

  private enviarArchivo(
    res: Response,
    archivo: { buffer: Buffer; nombre: string; contentType: string },
  ) {
    res.set({
      'Content-Type': archivo.contentType,
      'Content-Disposition': `attachment; filename="${archivo.nombre}"`,
      'Content-Length': archivo.buffer.length,
    });
    res.send(archivo.buffer);
  }
}
