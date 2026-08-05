import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { CreateSerieDocumentoDto } from './dto/create-serie-documento.dto';
import { UpdateSerieDocumentoDto } from './dto/update-serie-documento.dto';
import { SeriesDocumentosService } from './series-documentos.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Series de Documentos')
@Controller('series-documentos')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class SeriesDocumentosController {
  constructor(private readonly seriesDocumentosService: SeriesDocumentosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las series de documentos de la botica' })
  async listar(@Request() req: any) {
    const list = await this.seriesDocumentosService.listar(req.botica_id);
    return { data: list };
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva serie de documento' })
  async crear(@Request() req: any, @Body() dto: CreateSerieDocumentoDto) {
    const created = await this.seriesDocumentosService.crear(req.botica_id, dto);
    return { data: created };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una serie de documento por ID' })
  async actualizar(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateSerieDocumentoDto) {
    const updated = await this.seriesDocumentosService.actualizar(req.botica_id, id, dto);
    return { data: updated };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una serie de documento por ID' })
  async eliminar(@Request() req: any, @Param('id') id: string) {
    return this.seriesDocumentosService.eliminar(req.botica_id, id);
  }
}
