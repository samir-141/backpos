import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSerieDocumentoDto } from './dto/create-serie-documento.dto';
import { UpdateSerieDocumentoDto } from './dto/update-serie-documento.dto';

@Injectable()
export class SeriesDocumentosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(boticaId: string) {
    return this.prisma.series_documentos.findMany({
      where: { botica_id: boticaId },
      orderBy: [{ tipo_documento: 'asc' }, { serie: 'asc' }],
    });
  }

  async crear(boticaId: string, dto: CreateSerieDocumentoDto) {
    if (dto.sucursal_id) {
      const sucursal = await this.prisma.sucursales.findFirst({
        where: { id: dto.sucursal_id, botica_id: boticaId, deleted_at: null },
      });
      if (!sucursal) {
        throw new BadRequestException(
          'La sucursal indicada no pertenece a la botica.',
        );
      }
    }

    const serieUpper = dto.serie.trim().toUpperCase();
    const existing = await this.prisma.series_documentos.findFirst({
      where: {
        botica_id: boticaId,
        serie: serieUpper,
        tipo_documento: dto.tipo_documento,
        sucursal_id: dto.sucursal_id || null,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Ya existe una serie registrada con el mismo código y tipo de documento para esta sucursal/sede.',
      );
    }

    return this.prisma.series_documentos.create({
      data: {
        botica_id: boticaId,
        tipo_documento: dto.tipo_documento,
        serie: serieUpper,
        correlativo_inicial: dto.correlativo_inicial ?? 1,
        correlativo_actual: dto.correlativo_actual ?? 1,
        longitud_correlativo: dto.longitud_correlativo ?? 8,
        sucursal_id: dto.sucursal_id || null,
        activo: dto.activo ?? true,
      },
    });
  }

  async actualizar(boticaId: string, id: string, dto: UpdateSerieDocumentoDto) {
    const serie = await this.prisma.series_documentos.findFirst({
      where: { id, botica_id: boticaId },
    });
    if (!serie) {
      throw new NotFoundException('Serie de documento no encontrada.');
    }

    if (dto.sucursal_id) {
      const sucursal = await this.prisma.sucursales.findFirst({
        where: { id: dto.sucursal_id, botica_id: boticaId, deleted_at: null },
      });
      if (!sucursal) {
        throw new BadRequestException(
          'La sucursal indicada no pertenece a la botica.',
        );
      }
    }

    if (
      dto.serie !== undefined ||
      dto.tipo_documento !== undefined ||
      dto.sucursal_id !== undefined
    ) {
      const targetSerie =
        dto.serie !== undefined ? dto.serie.trim().toUpperCase() : serie.serie;
      const targetTipo =
        dto.tipo_documento !== undefined
          ? dto.tipo_documento
          : serie.tipo_documento;
      const targetSucursal =
        dto.sucursal_id !== undefined
          ? dto.sucursal_id || null
          : serie.sucursal_id;

      const existing = await this.prisma.series_documentos.findFirst({
        where: {
          id: { not: id },
          botica_id: boticaId,
          serie: targetSerie,
          tipo_documento: targetTipo,
          sucursal_id: targetSucursal,
        },
      });
      if (existing) {
        throw new BadRequestException(
          'Ya existe otra serie registrada con el mismo código y tipo de documento para esta sucursal/sede.',
        );
      }
    }

    return this.prisma.series_documentos.update({
      where: { id },
      data: {
        tipo_documento: dto.tipo_documento,
        serie: dto.serie ? dto.serie.trim().toUpperCase() : undefined,
        correlativo_inicial: dto.correlativo_inicial,
        correlativo_actual: dto.correlativo_actual,
        longitud_correlativo: dto.longitud_correlativo,
        sucursal_id: dto.sucursal_id === '' ? null : dto.sucursal_id,
        activo: dto.activo,
      },
    });
  }

  async eliminar(boticaId: string, id: string) {
    const serie = await this.prisma.series_documentos.findFirst({
      where: { id, botica_id: boticaId },
    });
    if (!serie) {
      throw new NotFoundException('Serie de documento no encontrada.');
    }

    await this.prisma.series_documentos.delete({
      where: { id },
    });

    return { mensaje: 'Serie de documento eliminada correctamente' };
  }
}
