import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@ApiTags('Usuarios & Administración')
@Controller('usuarios')
export class UsuariosController {
    constructor(private readonly usuariosService: UsuariosService) { }

    @Get()
    @ApiOperation({ summary: 'Listar todos los usuarios del sistema' })
    findAll() {
        return this.usuariosService.findAll();
    }

    @Get('roles')
    @ApiOperation({ summary: 'Listar roles del sistema y sus permisos' })
    getRoles() {
        return this.usuariosService.getRoles();
    }

    @Get('sucursales')
    @ApiOperation({ summary: 'Listar sucursales de la empresa' })
    getSucursales() {
        return this.usuariosService.getSucursales();
    }

    @Post('sucursales')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Registrar nueva sucursal' })
    createSucursal(@Body() body: { nombre: string; direccion: string; telefono?: string }) {
        return this.usuariosService.createSucursal(body);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener detalle de un usuario por ID' })
    findOne(@Param('id') id: string) {
        return this.usuariosService.findOne(id);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Registrar un nuevo usuario' })
    create(@Body() createDto: CreateUsuarioDto) {
        return this.usuariosService.create(createDto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar información o contraseña de usuario' })
    update(@Param('id') id: string, @Body() updateDto: UpdateUsuarioDto) {
        return this.usuariosService.update(id, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
    remove(@Param('id') id: string) {
        return this.usuariosService.remove(id);
    }
}