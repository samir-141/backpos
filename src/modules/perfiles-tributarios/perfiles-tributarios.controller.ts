import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import type { RequestAutenticada } from '../../auth/interfaces/request-autenticada.interface';
import { PerfilesTributariosService } from './perfiles-tributarios.service';
import { CreatePerfilTributarioDto } from './dto/create-perfil-tributario.dto';
import { UpdatePerfilTributarioDto } from './dto/update-perfil-tributario.dto';
import { GuardarConfigEmisionDto } from './dto/guardar-config-emision.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Perfiles Tributarios (Multi-RUC)')
@Controller('perfiles-tributarios')
@UseGuards(TenantGuard, RolesGuard, PermissionsGuard)
export class PerfilesTributariosController {
  constructor(private readonly service: PerfilesTributariosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar emisores / perfiles tributarios de la empresa',
  })
  listar(@Request() req: RequestAutenticada) {
    return this.service.listar(req.botica_id);
  }

  @Get('consultar-ruc/:ruc')
  @ApiOperation({ summary: 'Consultar datos de RUC en padrón SUNAT' })
  consultarRuc(@Param('ruc') ruc: string) {
    return this.service.consultarRuc(ruc);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un perfil tributario' })
  obtener(@Request() req: RequestAutenticada, @Param('id') id: string) {
    return this.service.obtener(req.botica_id, id);
  }

  @Get(':id/capacidades')
  @ApiOperation({
    summary: 'Consultar capacidades y validaciones de emisión de un perfil',
  })
  obtenerCapacidades(
    @Request() req: RequestAutenticada,
    @Param('id') id: string,
  ) {
    return this.service.obtenerCapacidades(req.botica_id, id);
  }

  @Post(':id/verificar')
  @RequirePermissions('facturacion.config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Verificar configuración de emisión de un perfil' })
  verificar(@Param('id') id: string, @Request() req: RequestAutenticada) {
    return this.service.verificar(req.botica_id, id, req.user.id);
  }

  @Post()
  @RequirePermissions('facturacion.config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Crear nuevo emisor / perfil tributario' })
  crear(
    @Body() dto: CreatePerfilTributarioDto,
    @Request() req: RequestAutenticada,
  ) {
    return this.service.crear(req.botica_id, dto, req.user.id);
  }

  @Put(':id')
  @RequirePermissions('facturacion.config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar perfil tributario' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: UpdatePerfilTributarioDto,
    @Request() req: RequestAutenticada,
  ) {
    return this.service.actualizar(req.botica_id, id, dto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions('facturacion.config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar perfil tributario (alias PATCH)' })
  actualizarPatch(
    @Param('id') id: string,
    @Body() dto: UpdatePerfilTributarioDto,
    @Request() req: RequestAutenticada,
  ) {
    return this.service.actualizar(req.botica_id, id, dto, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions('facturacion.config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar perfil tributario' })
  eliminar(@Param('id') id: string, @Request() req: RequestAutenticada) {
    return this.service.eliminar(req.botica_id, id, req.user.id);
  }

  @Put(':id/configuracion-emision')
  @RequirePermissions('facturacion.config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({
    summary: 'Actualizar configuración de emisión y credenciales SOL',
  })
  guardarConfigEmision(
    @Param('id') id: string,
    @Body() dto: GuardarConfigEmisionDto,
    @Request() req: RequestAutenticada,
  ) {
    return this.service.guardarConfigEmision(
      req.botica_id,
      id,
      dto,
      req.user.id,
    );
  }

  @Post(':id/configuracion-emision')
  @RequirePermissions('facturacion.config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({
    summary: 'Actualizar configuración de emisión y credenciales SOL (alias POST)',
  })
  guardarConfigEmisionPost(
    @Param('id') id: string,
    @Body() dto: GuardarConfigEmisionDto,
    @Request() req: RequestAutenticada,
  ) {
    return this.service.guardarConfigEmision(
      req.botica_id,
      id,
      dto,
      req.user.id,
    );
  }

  @Post(':id/certificado')
  @RequirePermissions('facturacion.config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Subir certificado digital para este perfil' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  subirCertificado(
    @Param('id') id: string,
    @UploadedFile()
    archivo: { buffer: Buffer; originalname: string; size: number } | undefined,
    @Body('password') password: string | undefined,
    @Body('clave') clave: string | undefined,
    @Request() req: RequestAutenticada,
  ) {
    if (!archivo) {
      throw new BadRequestException('Debe adjuntar el archivo de certificado');
    }
    const passwordEfectiva = password || clave;
    if (!passwordEfectiva) {
      throw new BadRequestException(
        'Debe indicar la contraseña del certificado',
      );
    }
    return this.service.guardarCertificado(
      req.botica_id,
      id,
      archivo,
      passwordEfectiva,
      req.user.id,
    );
  }
}
