import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdministracionGeneralService } from './administracion-general.service';
import { PlatformAdminGuard } from '../../auth/guards/platform-admin.guard';
import {
  CreateBoticaDto,
  CreateColaboradorDto,
  CreateSucursalDto,
  UpdateBoticaDto,
  UpdateColaboradorDto,
  UpdateEstadoBoticaDto,
  UpdateSucursalDto,
  PaginationQueryDto,
} from './dto/administracion-general.dto';

@Controller('administracion-general')
@UseGuards(PlatformAdminGuard)
export class AdministracionGeneralController {
  constructor(private readonly service: AdministracionGeneralService) {}

  @Get('resumen')
  resumen(@Query() query: PaginationQueryDto) {
    return this.service.getResumen(query);
  }

  @Get('boticas/:boticaId/colaboradores')
  colaboradores(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.getColaboradores(boticaId, query);
  }

  @Get('boticas/:boticaId/roles')
  roles(@Param('boticaId', ParseUUIDPipe) boticaId: string) {
    return this.service.getRoles(boticaId);
  }

  @Post('boticas')
  crearBotica(@Body() body: CreateBoticaDto) {
    return this.service.crearBotica(body);
  }

  @Patch('boticas/:boticaId')
  actualizarBotica(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Body() body: UpdateBoticaDto,
  ) {
    return this.service.actualizarBotica(boticaId, body);
  }

  @Delete('boticas/:boticaId')
  archivarBotica(@Param('boticaId', ParseUUIDPipe) boticaId: string) {
    return this.service.archivarBotica(boticaId);
  }

  @Post('boticas/:boticaId/sucursales')
  crearSucursal(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Body() body: CreateSucursalDto,
  ) {
    return this.service.crearSucursal(boticaId, body);
  }

  @Patch('boticas/:boticaId/sucursales/:sucursalId')
  actualizarSucursal(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Param('sucursalId', ParseUUIDPipe) sucursalId: string,
    @Body() body: UpdateSucursalDto,
  ) {
    return this.service.actualizarSucursal(boticaId, sucursalId, body);
  }

  @Delete('boticas/:boticaId/sucursales/:sucursalId')
  archivarSucursal(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Param('sucursalId', ParseUUIDPipe) sucursalId: string,
  ) {
    return this.service.archivarSucursal(boticaId, sucursalId);
  }

  @Post('boticas/:boticaId/colaboradores')
  crearColaborador(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Body() body: CreateColaboradorDto,
  ) {
    return this.service.crearColaborador(boticaId, body);
  }

  @Patch('boticas/:boticaId/colaboradores/:usuarioId')
  actualizarColaborador(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() body: UpdateColaboradorDto,
  ) {
    return this.service.actualizarColaborador(boticaId, usuarioId, body);
  }

  @Delete('boticas/:boticaId/colaboradores/:usuarioId')
  archivarColaborador(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
  ) {
    return this.service.archivarColaborador(boticaId, usuarioId);
  }

  @Patch('boticas/:boticaId/estado')
  estadoBotica(
    @Param('boticaId', ParseUUIDPipe) boticaId: string,
    @Body() body: UpdateEstadoBoticaDto,
  ) {
    return this.service.estadoBotica(boticaId, body.estado);
  }
}
