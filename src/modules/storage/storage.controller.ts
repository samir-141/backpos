import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { StorageService, type SubcarpetaBotica } from './storage.service';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { RequestAutenticada } from '../../auth/interfaces/request-autenticada.interface';

@ApiTags('Almacenamiento (Supabase Storage)')
@Controller('storage')
@UseGuards(TenantGuard, RolesGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('test-conexion')
  @ApiOperation({
    summary: 'Probar conexión y estado de buckets en Supabase Storage',
  })
  async testConexion() {
    return this.storageService.probarConexion();
  }

  @Post('logo')
  @Roles('ADMINISTRADOR', 'GERENTE')
  @ApiOperation({ summary: 'Subir logo de la botica a su carpeta aislada' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB máx
    }),
  )
  async subirLogo(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Request() req: RequestAutenticada,
  ) {
    if (!file) {
      throw new BadRequestException('Debe seleccionar un archivo de imagen.');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        'El archivo debe ser una imagen válida (PNG, JPG, WEBP).',
      );
    }

    const extension = file.originalname.split('.').pop() || 'png';
    const nombreArchivo = `logo_${Date.now()}.${extension}`;

    const resultado = await this.storageService.subirArchivo({
      boticaId: req.botica_id,
      carpeta: 'logos',
      nombreArchivo,
      buffer: file.buffer,
      mimeType: file.mimetype,
      esPublico: true,
    });

    if (!resultado.ok) {
      throw new BadRequestException(
        resultado.error || 'Error al subir la imagen al almacenamiento.',
      );
    }

    // Actualizar la URL del logo en la configuración de la botica
    if (resultado.publicUrl) {
      const configActual =
        (await this.storageService.obtenerConfiguracionTicket(req.botica_id)) ||
        {};
      await this.storageService.guardarConfiguracionTicket(req.botica_id, {
        ...configActual,
        logoUrl: resultado.publicUrl,
        mostrarLogo: true,
      });
    }

    return {
      mensaje: 'Logo subido correctamente a Supabase Storage',
      publicUrl: resultado.publicUrl,
      path: resultado.path,
    };
  }

  @Get('config')
  @ApiOperation({
    summary: 'Obtener plantilla y diseño de ticket de la botica',
  })
  async obtenerConfiguracionTicket(@Request() req: RequestAutenticada) {
    const config = await this.storageService.obtenerConfiguracionTicket(
      req.botica_id,
    );
    return {
      boticaId: req.botica_id,
      config: config || null,
    };
  }

  @Post('config')
  @Roles('ADMINISTRADOR', 'GERENTE')
  @ApiOperation({
    summary: 'Guardar plantilla y diseño de ticket de la botica',
  })
  async guardarConfiguracionTicket(
    @Body() body: Record<string, any>,
    @Request() req: RequestAutenticada,
  ) {
    const ok = await this.storageService.guardarConfiguracionTicket(
      req.botica_id,
      body,
    );
    return {
      ok,
      mensaje: ok
        ? 'Configuración de ticket guardada en el servidor'
        : 'Error al guardar configuración',
    };
  }

  @Get('archivos/:carpeta')
  @Roles('ADMINISTRADOR', 'GERENTE', 'FARMACEUTICO')
  @ApiOperation({ summary: 'Listar archivos de la botica en una subcarpeta' })
  async listarArchivos(
    @Param('carpeta') carpeta: SubcarpetaBotica,
    @Request() req: RequestAutenticada,
  ) {
    const archivos = await this.storageService.listarArchivos(
      req.botica_id,
      carpeta,
    );
    return {
      boticaId: req.botica_id,
      carpeta,
      total: archivos.length,
      archivos,
    };
  }

  @Delete('archivos/:carpeta/:nombre')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar un archivo de la botica' })
  async eliminarArchivo(
    @Param('carpeta') carpeta: SubcarpetaBotica,
    @Param('nombre') nombre: string,
    @Request() req: RequestAutenticada,
  ) {
    const ok = await this.storageService.eliminarArchivo(
      req.botica_id,
      carpeta,
      nombre,
    );
    return {
      ok,
      mensaje: ok
        ? 'Archivo eliminado correctamente'
        : 'No se pudo eliminar el archivo',
    };
  }
}
