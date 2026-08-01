import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdministracionGeneralService } from './administracion-general.service';

@Controller('administracion-general')
@UseGuards(AuthGuard('jwt'))
export class AdministracionGeneralController {
  constructor(
    private readonly service: AdministracionGeneralService,
  ) {}

  private checkSuperAdmin(req: any) {
    const rol = String(req.user?.rol || '').toUpperCase();
    if (rol !== 'ADMINISTRADOR') {
      throw new ForbiddenException('No tiene privilegios para acceder a este recurso.');
    }
  }

  @Get('resumen')
  resumen(@Request() req: any) {
    this.checkSuperAdmin(req);
    return this.service.getResumen();
  }

  @Get('boticas/:boticaId/colaboradores')
  colaboradores(@Request() req: any, @Param('boticaId') boticaId: string) {
    this.checkSuperAdmin(req);
    return this.service.getColaboradores(boticaId);
  }

  @Get('boticas/:boticaId/roles')
  roles(@Request() req: any, @Param('boticaId') boticaId: string) {
    this.checkSuperAdmin(req);
    return this.service.getRoles(boticaId);
  }

  @Post('boticas')
  crearBotica(@Request() req: any, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.service.crearBotica(body);
  }

  @Patch('boticas/:boticaId')
  actualizarBotica(@Request() req: any, @Param('boticaId') boticaId: string, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.service.actualizarBotica(boticaId, body);
  }

  @Delete('boticas/:boticaId')
  archivarBotica(@Request() req: any, @Param('boticaId') boticaId: string) {
    this.checkSuperAdmin(req);
    return this.service.archivarBotica(boticaId);
  }

  @Post('boticas/:boticaId/sucursales')
  crearSucursal(@Request() req: any, @Param('boticaId') boticaId: string, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.service.crearSucursal(boticaId, body);
  }

  @Patch('boticas/:boticaId/sucursales/:sucursalId')
  actualizarSucursal(
    @Request() req: any,
    @Param('boticaId') boticaId: string,
    @Param('sucursalId') sucursalId: string,
    @Body() body: any,
  ) {
    this.checkSuperAdmin(req);
    return this.service.actualizarSucursal(sucursalId, body);
  }

  @Delete('boticas/:boticaId/sucursales/:sucursalId')
  archivarSucursal(
    @Request() req: any,
    @Param('boticaId') boticaId: string,
    @Param('sucursalId') sucursalId: string,
  ) {
    this.checkSuperAdmin(req);
    return this.service.archivarSucursal(sucursalId);
  }

  @Post('boticas/:boticaId/colaboradores')
  crearColaborador(@Request() req: any, @Param('boticaId') boticaId: string, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.service.crearColaborador(boticaId, body);
  }

  @Patch('boticas/:boticaId/colaboradores/:usuarioId')
  actualizarColaborador(
    @Request() req: any,
    @Param('boticaId') boticaId: string,
    @Param('usuarioId') usuarioId: string,
    @Body() body: any,
  ) {
    this.checkSuperAdmin(req);
    return this.service.actualizarColaborador(boticaId, usuarioId, body);
  }

  @Delete('boticas/:boticaId/colaboradores/:usuarioId')
  archivarColaborador(
    @Request() req: any,
    @Param('boticaId') boticaId: string,
    @Param('usuarioId') usuarioId: string,
  ) {
    this.checkSuperAdmin(req);
    return this.service.archivarColaborador(usuarioId);
  }

  @Patch('boticas/:boticaId/estado')
  estadoBotica(@Request() req: any, @Param('boticaId') boticaId: string, @Body() body: any) {
    this.checkSuperAdmin(req);
    return this.service.estadoBotica(boticaId, body.estado);
  }
}
