import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CreateSerieDocumentoDto } from './dto/create-serie-documento.dto';
import { UpdateSerieDocumentoDto } from './dto/update-serie-documento.dto';
import { SeriesDocumentosService } from './series-documentos.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Series de Documentos')
@Controller('series-documentos')
@UseGuards(TenantGuard, PermissionsGuard)
export class SeriesDocumentosController {
  constructor(
    private readonly seriesDocumentosService: SeriesDocumentosService,
  ) {}

  @Get()
  @RequirePermissions('series.ver')
  @ApiOperation({
  })
  async listar(@Request() req: any) {
    const list = await this.seriesDocumentosService.listar(req.botica_id);
    return { data: list };
  }

  @Post()
  @RequirePermissions('series.gestionar')
  @ApiOperation({ summary: 'Crear una nueva serie de documento' })
  async crear(@Request() req: any, @Body() dto: CreateSerieDocumentoDto) {
    const created = await this.seriesDocumentosService.crear(
      req.botica_id,
      dto,
    );
    return { data: created };
  }

  @Patch(':id')
  @RequirePermissions('series.gestionar')
  @ApiOperation({ summary: 'Actualizar una serie de documento por ID' })
  async actualizar(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSerieDocumentoDto,
  ) {
    const updated = await this.seriesDocumentosService.actualizar(
      req.botica_id,
      id,
      dto,
    );
    return { data: updated };
  }

  @Delete(':id')
  @RequirePermissions('series.gestionar')
  @ApiOperation({ summary: 'Eliminar una serie de documento por ID' })
  async eliminar(@Request() req: any, @Param('id') id: string) {
    return this.seriesDocumentosService.eliminar(req.botica_id, id);
  }
}
