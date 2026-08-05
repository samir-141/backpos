import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import type { RequestAutenticada } from '../../../auth/interfaces/request-autenticada.interface';
import { ConfiguracionTributariaService } from '../services/configuracion-tributaria.service';
import { GuardarConfiguracionTributariaDto } from '../dtos/configuracion-tributaria.dto';
import { TenantGuard } from '../../../auth/guards/tenant.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

@ApiTags('Configuración Tributaria')
@Controller('facturacion/configuracion-tributaria')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class ConfiguracionTributariaController {
  constructor(private readonly configuracion: ConfiguracionTributariaService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener configuración tributaria de la empresa' })
  obtener(@Request() req: RequestAutenticada) {
    return this.configuracion.obtener(req.botica_id);
  }

  @Post()
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Crear configuración tributaria' })
  guardar(
    @Body() dto: GuardarConfiguracionTributariaDto,
    @Request() req: RequestAutenticada,
  ) {
    return this.configuracion.guardar(dto, req.botica_id, req.user.id);
  }

  @Patch()
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar configuración tributaria' })
  actualizar(
    @Body() dto: GuardarConfiguracionTributariaDto,
    @Request() req: RequestAutenticada,
  ) {
    return this.configuracion.guardar(dto, req.botica_id, req.user.id);
  }

  @Post('certificado')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Subir certificado digital (.pfx/.p12)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('certificado'))
  subirCertificado(
    @UploadedFile()
    archivo: { buffer: Buffer; originalname: string; size: number } | undefined,
    @Body('clave') clave: string | undefined,
    @Request() req: RequestAutenticada,
  ) {
    if (!archivo) {
      throw new BadRequestException('Debe adjuntar el certificado');
    }
    if (!clave) {
      throw new BadRequestException(
        'Debe indicar la contraseña del certificado',
      );
    }
    return this.configuracion.guardarCertificado(
      req.botica_id,
      archivo,
      clave,
      req.user.id,
    );
  }

  @Post('probar-conexion')
  @Roles('ADMINISTRADOR')
  @ApiOperation({
    summary: 'Verificar que la configuración esté completa para emitir',
  })
  probarConexion(@Request() req: RequestAutenticada) {
    return this.configuracion.estadoParaEmision(req.botica_id);
  }
}
