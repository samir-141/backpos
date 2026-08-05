import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../../socket/events.gateway';
import { CreateDevolucionDto } from './dto/create-devolucion.dto';
import { CreateCambioDto } from './dto/create-cambio.dto';
import { CreateGarantiaDto } from './dto/create-garantia.dto';
import { CreateReclamoDto } from './dto/create-reclamo.dto';

@Injectable()
export class PosventaService {
  private readonly logger = new Logger(PosventaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async createDevolucion(dto: CreateDevolucionDto, boticaId: string) {
    this.logger.log(`Registrando devolución para venta ${dto.venta_id}`);

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'La devolución debe incluir al menos un producto.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const venta = await tx.ventas.findFirst({
        where: { id: dto.venta_id, deleted_at: null, botica_id: boticaId },
        include: { detalles_ventas: true },
      });

      if (!venta) {
        throw new NotFoundException(
          `Venta con ID ${dto.venta_id} no encontrada`,
        );
      }

      if (venta.estado === 'ANULADO') {
        throw new BadRequestException(`La venta ${dto.venta_id} está anulada.`);
      }

      for (const item of dto.items) {
        const detalle = venta.detalles_ventas.find(
          (d) => d.id === item.detalle_venta_id,
        );

        if (!detalle) {
          throw new NotFoundException(
            `Detalle de venta ${item.detalle_venta_id} no encontrado`,
          );
        }

        if (item.cantidad > detalle.cantidad) {
          throw new BadRequestException(
            `Cantidad a devolver (${item.cantidad}) excede la cantidad comprada (${detalle.cantidad})`,
          );
        }

        if (detalle.lote_id) {
          const lote = await tx.lotes.findFirst({
            where: { id: detalle.lote_id },
          });

          if (lote) {
            await tx.lotes.update({
              where: { id: lote.id },
              data: {
                stock_actual: lote.stock_actual + item.cantidad,
              },
            });
          }
        }
      }

      await this.auditService.registrar({
        usuario_id: dto.usuario_id,
        accion: 'DEVOLUCION_CREADA',
        tabla: 'devoluciones',
        observacion: `Devolución registrada para venta ${dto.venta_id} - ${dto.items.length} items`,
      });

      this.eventsGateway.emitirEvento('devolucion.creada', {
        venta_id: dto.venta_id,
      });

      return {
        exito: true,
        mensaje: 'Devolución registrada correctamente',
        venta_id: dto.venta_id,
      };
    });
  }

  async createCambio(dto: CreateCambioDto, boticaId: string) {
    this.logger.log(`Registrando cambio para venta ${dto.venta_id}`);

    if (!dto.items_devolver || dto.items_devolver.length === 0) {
      throw new BadRequestException(
        'El cambio debe incluir al menos un producto a devolver.',
      );
    }

    if (!dto.items_entregar || dto.items_entregar.length === 0) {
      throw new BadRequestException(
        'El cambio debe incluir al menos un producto a entregar.',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const venta = await tx.ventas.findFirst({
        where: { id: dto.venta_id, deleted_at: null, botica_id: boticaId },
        include: { detalles_ventas: true, cajas: true },
      });

      if (!venta) {
        throw new NotFoundException(
          `Venta con ID ${dto.venta_id} no encontrada`,
        );
      }

      if (venta.estado === 'ANULADO') {
        throw new BadRequestException(`La venta ${dto.venta_id} está anulada.`);
      }

      for (const item of dto.items_devolver) {
        const detalle = venta.detalles_ventas.find(
          (d) => d.id === item.detalle_venta_id,
        );

        if (!detalle) {
          throw new NotFoundException(
            `Detalle de venta ${item.detalle_venta_id} no encontrado`,
          );
        }

        if (item.cantidad > detalle.cantidad) {
          throw new BadRequestException(
            `Cantidad a devolver (${item.cantidad}) excede la cantidad comprada (${detalle.cantidad})`,
          );
        }

        if (detalle.lote_id) {
          const lote = await tx.lotes.findFirst({
            where: { id: detalle.lote_id },
          });

          if (lote) {
            await tx.lotes.update({
              where: { id: lote.id },
              data: {
                stock_actual: lote.stock_actual + item.cantidad,
              },
            });
          }
        }
      }

      for (const item of dto.items_entregar) {
        const lotesDisponibles = await tx.lotes.findMany({
          where: {
            producto_comercial_id: item.producto_comercial_id,
            sucursal_id: venta.cajas?.sucursal_id || undefined,
            deleted_at: null,
          },
          orderBy: [{ fecha_vencimiento: 'asc' }, { stock_actual: 'desc' }],
        });

        let unidadesPendientes = item.cantidad;

        for (const lote of lotesDisponibles) {
          if (unidadesPendientes <= 0) break;

          const descontar = Math.min(lote.stock_actual, unidadesPendientes);
          unidadesPendientes -= descontar;

          await tx.lotes.update({
            where: { id: lote.id },
            data: {
              stock_actual: lote.stock_actual - descontar,
            },
          });
        }
      }

      await this.auditService.registrar({
        usuario_id: dto.usuario_id,
        accion: 'CAMBIO_CREADO',
        tabla: 'cambios',
        observacion: `Cambio registrado para venta ${dto.venta_id}`,
      });

      this.eventsGateway.emitirEvento('cambio.creado', {
        venta_id: dto.venta_id,
      });

      return {
        exito: true,
        mensaje: 'Cambio registrado correctamente',
        venta_id: dto.venta_id,
      };
    });
  }

  async createGarantia(dto: CreateGarantiaDto, boticaId: string) {
    this.logger.log(`Registrando garantía para venta ${dto.venta_id}`);

    const venta = await this.prisma.ventas.findFirst({
      where: { id: dto.venta_id, deleted_at: null, botica_id: boticaId },
    });

    if (!venta) {
      throw new NotFoundException(`Venta con ID ${dto.venta_id} no encontrada`);
    }

    if (venta.estado === 'ANULADO') {
      throw new BadRequestException(`La venta ${dto.venta_id} está anulada.`);
    }

    await this.auditService.registrar({
      usuario_id: dto.usuario_id,
      accion: 'GARANTIA_REGISTRADA',
      tabla: 'garantias',
      observacion: `Garantía ${dto.tipo} registrada para venta ${dto.venta_id} - ${dto.motivo}`,
    });

    this.eventsGateway.emitirEvento('garantia.registrada', {
      venta_id: dto.venta_id,
      tipo: dto.tipo,
    });

    return {
      exito: true,
      mensaje: 'Garantía registrada correctamente',
      venta_id: dto.venta_id,
      tipo: dto.tipo,
    };
  }

  async createReclamo(dto: CreateReclamoDto, boticaId: string) {
    this.logger.log(`Registrando reclamo para venta ${dto.venta_id}`);

    const venta = await this.prisma.ventas.findFirst({
      where: { id: dto.venta_id, deleted_at: null, botica_id: boticaId },
    });

    if (!venta) {
      throw new NotFoundException(`Venta con ID ${dto.venta_id} no encontrada`);
    }

    await this.auditService.registrar({
      usuario_id: dto.usuario_id,
      accion: 'RECLAMO_CREADO',
      tabla: 'reclamos',
      observacion: `Reclamo ${dto.tipo} registrado para venta ${dto.venta_id}`,
    });

    this.eventsGateway.emitirEvento('reclamo.creado', {
      venta_id: dto.venta_id,
      tipo: dto.tipo,
    });

    return {
      exito: true,
      mensaje: 'Reclamo registrado correctamente',
      venta_id: dto.venta_id,
      tipo: dto.tipo,
    };
  }

  async findByVenta(ventaId: string, boticaId: string) {
    return {
      venta_id: ventaId,
      devoluciones: [],
      cambios: [],
      garantias: [],
      reclamos: [],
    };
  }
}
