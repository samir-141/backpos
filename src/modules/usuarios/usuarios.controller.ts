import {
  Controller,
  Get,
  Post,
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

  @Get('sucursales')
  @ApiOperation({ summary: 'Listar sucursales de la empresa' })
  getSucursales(@Request() req: any) {
    return this.usuariosService.getSucursales(req.botica_id);
  }

  @Post('sucursales')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nueva sucursal' })
  createSucursal(
    @Body() body: { nombre: string; direccion: string; telefono?: string },
    @Request() req: any,
  ) {
    return this.usuariosService.createSucursal(req.botica_id, body, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un usuario por ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.usuariosService.findOne(req.botica_id, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  create(@Body() createDto: CreateUsuarioDto, @Request() req: any) {
    return this.usuariosService.create(req.botica_id, createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar información o contraseña de usuario' })
  update(@Param('id') id: string, @Body() updateDto: UpdateUsuarioDto, @Request() req: any) {
    return this.usuariosService.update(req.botica_id, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.usuariosService.remove(req.botica_id, id);
  }
}
