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

import { SunatSolBotService } from '../sunat-sol/sunat-sol-bot.service';
import { SolBotEmitirBoletaDto } from '../dtos/sol-bot.dto';
import { EncryptionService } from '../../../common/security/encryption.service';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Facturación Electrónica')
@Controller('facturacion')
@UseGuards(TenantGuard, PermissionsGuard)
export class FacturacionController {
  constructor(
    private readonly facturacionService: FacturacionService,
    private readonly solBotService: SunatSolBotService,
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('sol-bot/test-conexion')
  @RequirePermissions('facturacion.configurar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Probar conexión y credenciales Clave SOL en el portal SUNAT con Playwright',
  })
  async testConexionSol(
    @Request() req: RequestAutenticada,
    @Body()
    body: {
      headless?: boolean;
      credenciales?: {
        ruc?: string;
        dni?: string;
        usuario?: string;
        clave?: string;
        modoAcceso?: 'DNI' | 'RUC';
      };
    },
  ) {
    const headless = body?.headless !== undefined ? body.headless : true;

    // 1. Si vienen credenciales explícitas en el body para prueba interactiva
    if (
      body?.credenciales?.clave &&
      (body?.credenciales?.dni ||
        body?.credenciales?.usuario ||
        body?.credenciales?.ruc)
    ) {
      return this.solBotService.testConexion(
        {
          ruc: body.credenciales.ruc,
          dni: body.credenciales.dni,
          usuario: body.credenciales.usuario,
          clave: body.credenciales.clave,
          modoAcceso: body.credenciales.modoAcceso,
        },
        headless,
      );
    }

    // 2. Buscar en perfiles_tributarios (emisor principal o activo)
    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: {
        botica_id: req.botica_id,
        deleted_at: null,
        activo: true,
      },
      orderBy: [{ es_principal: 'desc' }, { created_at: 'asc' }],
      include: { configuracion_emision: true },
    });

    if (
      perfil?.configuracion_emision?.sol_clave_encriptada &&
      (perfil?.configuracion_emision?.sol_usuario_encriptado || perfil?.ruc)
    ) {
      const solClave = this.encryption.decrypt(
        perfil.configuracion_emision.sol_clave_encriptada,
      );
      const solUsuario = perfil.configuracion_emision.sol_usuario_encriptado
        ? this.encryption.decrypt(
            perfil.configuracion_emision.sol_usuario_encriptado,
          )
        : undefined;

      const esDni = !solUsuario || perfil.ruc?.length === 8;

      return this.solBotService.testConexion(
        {
          ruc: perfil.ruc,
          dni: esDni ? solUsuario || perfil.ruc : undefined,
          usuario: solUsuario,
          clave: solClave,
          modoAcceso: esDni ? 'DNI' : 'RUC',
        },
        headless,
      );
    }

    // 3. Fallback a legacy configuraciones_tributarias
    const config = await this.prisma.configuraciones_tributarias.findUnique({
      where: { botica_id: req.botica_id },
    });

    if (!config || !config.sol_clave_encriptada) {
      return {
        exito: false,
        mensaje:
          'No se han configurado el usuario/DNI y la clave SOL para esta botica',
      };
    }

    const solUsuario = config.sol_usuario_encriptado
      ? this.encryption.decrypt(config.sol_usuario_encriptado)
      : undefined;
    const solClave = this.encryption.decrypt(config.sol_clave_encriptada);
    const esDni = !solUsuario || config.ruc?.length === 8;

    return this.solBotService.testConexion(
      {
        ruc: config.ruc,
        dni: esDni ? solUsuario || config.ruc : undefined,
        usuario: solUsuario,
        clave: solClave,
        modoAcceso: esDni ? 'DNI' : 'RUC',
      },
      headless,
    );
  }

  @Post('sol-bot/emitir-boleta')
  @RequirePermissions('facturacion.emitir')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Emitir boleta de venta electrónica automatizada en SUNAT SEE-SOL (Nuevo RUS) con Playwright',
  })
  async emitirBoletaSol(
    @Body() dto: SolBotEmitirBoletaDto,
    @Request() req: RequestAutenticada,
  ) {
    const config = await this.prisma.configuraciones_tributarias.findUnique({
      where: { botica_id: req.botica_id },
    });

    if (
      !config ||
      !config.sol_usuario_encriptado ||
      !config.sol_clave_encriptada
    ) {
      return {
        exito: false,
        mensaje:
          'Faltan credenciales SOL en la configuración tributaria de la botica',
      };
    }

    const solUsuario = this.encryption.decrypt(config.sol_usuario_encriptado);
    const solClave = this.encryption.decrypt(config.sol_clave_encriptada);

    return this.solBotService.emitirBoletaSol({
      boticaId: req.botica_id,
      credenciales: {
        ruc: config.ruc,
        usuario: solUsuario,
        clave: solClave,
      },
      receptor: dto.receptor,
      items: dto.items,
      observaciones: dto.observaciones,
      headless: dto.headless !== undefined ? dto.headless : true,
    });
  }

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
