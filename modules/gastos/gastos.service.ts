import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGastoDto } from './dto/create-gasto.dto';

@Injectable()
export class GastosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(boticaId: string, sucursalId?: string, desde?: string, hasta?: string) {
    return this.prisma.gastos_operativos.findMany({
      where: {
        botica_id: boticaId,
        deleted_at: null,
        ...(sucursalId ? { sucursal_id: sucursalId } : {}),
        ...(desde || hasta
          ? { fecha: { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) } }
          : {}),
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async crear(boticaId: string, dto: CreateGastoDto) {
    if (dto.sucursal_id) {
      const sucursal = await this.prisma.sucursales.findFirst({
        where: { id: dto.sucursal_id, botica_id: boticaId, deleted_at: null },
      });
      if (!sucursal) throw new BadRequestException('La sucursal indicada no pertenece a la botica actual.');
    }

    return this.prisma.gastos_operativos.create({
      data: {
        botica_id: boticaId,
        sucursal_id: dto.sucursal_id,
        tipo: dto.tipo,
        categoria: dto.categoria.trim(),
        descripcion: dto.descripcion?.trim() || null,
        comprobante: dto.comprobante?.trim() || null,
        monto: dto.monto,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
      },
    });
  }

  async eliminar(boticaId: string, id: string) {
    const gasto = await this.prisma.gastos_operativos.findFirst({
      where: { id, botica_id: boticaId, deleted_at: null },
    });
    if (!gasto) throw new BadRequestException('Gasto no encontrado.');
    await this.prisma.gastos_operativos.update({ where: { id }, data: { deleted_at: new Date() } });
    return { mensaje: 'Gasto eliminado correctamente' };
  }
}
