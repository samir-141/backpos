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

  async listar(boticaId: string, perfilTributarioId?: string) {
    return this.prisma.series_documentos.findMany({
      where: {
        botica_id: boticaId,
        ...(perfilTributarioId
          ? { perfil_tributario_id: perfilTributarioId }
          : {}),
      },
      include: {
        perfiles_tributarios: {
          select: {
            id: true,
            ruc: true,
            razon_social: true,
            regimen_tributario: true,
            es_principal: true,
          },
        },
      },
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

    if (dto.perfil_tributario_id) {
      const perfil = await this.prisma.perfiles_tributarios.findFirst({
        where: {
          id: dto.perfil_tributario_id,
          botica_id: boticaId,
          activo: true,
          deleted_at: null,
        },
      });
      if (!perfil) {
        throw new BadRequestException(
          'El perfil tributario indicado no existe o no pertenece a la botica.',
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
        perfil_tributario_id: dto.perfil_tributario_id || null,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Ya existe una serie registrada con el mismo código, tipo de documento y perfil tributario para esta sucursal.',
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
        perfil_tributario_id: dto.perfil_tributario_id || null,
        activo: dto.activo ?? true,
      },
      include: {
        perfiles_tributarios: true,
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

    if (dto.perfil_tributario_id) {
      const perfil = await this.prisma.perfiles_tributarios.findFirst({
        where: {
          id: dto.perfil_tributario_id,
          botica_id: boticaId,
          activo: true,
          deleted_at: null,
        },
      });
      if (!perfil) {
        throw new BadRequestException(
          'El perfil tributario indicado no existe o no pertenece a la botica.',
        );
      }
    }

    if (
      dto.serie !== undefined ||
      dto.tipo_documento !== undefined ||
      dto.sucursal_id !== undefined ||
      dto.perfil_tributario_id !== undefined
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
      const targetPerfil =
        dto.perfil_tributario_id !== undefined
          ? dto.perfil_tributario_id || null
          : serie.perfil_tributario_id;

      const existing = await this.prisma.series_documentos.findFirst({
        where: {
          id: { not: id },
          botica_id: boticaId,
          serie: targetSerie,
          tipo_documento: targetTipo,
          sucursal_id: targetSucursal,
          perfil_tributario_id: targetPerfil,
        },
      });
      if (existing) {
        throw new BadRequestException(
          'Ya existe otra serie registrada con el mismo código, tipo de documento y perfil tributario para esta sucursal.',
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
        perfil_tributario_id:
          dto.perfil_tributario_id === '' ? null : dto.perfil_tributario_id,
        activo: dto.activo,
      },
      include: {
        perfiles_tributarios: true,
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
