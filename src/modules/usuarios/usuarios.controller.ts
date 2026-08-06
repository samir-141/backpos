import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Usuarios & Administración')
@Controller('usuarios')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los usuarios de la botica' })
  findAll(@Request() req: any) {
    return this.usuariosService.findAll(req.botica_id);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Listar roles del sistema y sus permisos' })
  getRoles(@Request() req: any) {
    return this.usuariosService.getRoles(req.botica_id);
  }

  @Post('roles')
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nuevo rol para la botica' })
  createRol(@Body() body: { nombre: string }, @Request() req: any) {
    return this.usuariosService.createRol(req.botica_id, body.nombre, req.user.id);
  }

  @Patch('roles/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @ApiOperation({ summary: 'Actualizar nombre de rol' })
  updateRol(
    @Param('id') id: string,
    @Body() body: { nombre: string },
    @Request() req: any,
  ) {
    return this.usuariosService.updateRol(req.botica_id, id, body.nombre, req.user.id);
  }

  @Delete('roles/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @ApiOperation({ summary: 'Eliminar un rol (soft delete)' })
  deleteRol(@Param('id') id: string, @Request() req: any) {
    return this.usuariosService.deleteRol(req.botica_id, id, req.user.id);
  }

  @Put('roles/:rolId/permisos')
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @ApiOperation({ summary: 'Actualizar los permisos asignados a un rol' })
  actualizarRolPermisos(
    @Param('rolId') rolId: string,
    @Body() body: { permisosIds: string[] },
    @Request() req: any,
  ) {
    return this.usuariosService.actualizarRolPermisos(
      req.botica_id,
      rolId,
      body,
    );
  }

  @Get('sucursales')
  @ApiOperation({ summary: 'Listar sucursales de la empresa' })
  getSucursales(@Request() req: any) {
    return this.usuariosService.getSucursales(req.botica_id);
  }

  @Post('sucursales')
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nueva sucursal' })
  createSucursal(
    @Body() body: { nombre: string; direccion: string; telefono?: string },
    @Request() req: any,
  ) {
    return this.usuariosService.createSucursal(
      req.botica_id,
      body,
      req.user.id,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un usuario por ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.usuariosService.findOne(req.botica_id, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  create(@Body() createDto: CreateUsuarioDto, @Request() req: any) {
    return this.usuariosService.create(req.botica_id, createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @ApiOperation({ summary: 'Actualizar información o contraseña de usuario' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateUsuarioDto,
    @Request() req: any,
  ) {
    return this.usuariosService.update(req.botica_id, id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.usuariosService.remove(req.botica_id, id);
  }
}
