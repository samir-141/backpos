import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SyncQueueService {
  private readonly logger = new Logger(SyncQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPendingItems(boticaId: string, limit = 20) {
    return this.prisma.comprobantes_electronicos.findMany({
      where: {
        botica_id: boticaId,
        estado: { in: ['LOCAL', 'PENDIENTE', 'PENDING'] },
      },
      take: limit,
      orderBy: { created_at: 'asc' },
      include: { perfiles_tributarios: true, ventas: true },
    });
  }

  async recordSyncAttempt(
    comprobanteId: string,
    success: boolean,
    details?: {
      sunatResponseCode?: string;
      sunatDescription?: string;
      error?: string;
    },
  ) {
    if (success) {
      await this.prisma.comprobantes_electronicos.update({
        where: { id: comprobanteId },
        data: {
          estado: 'ACEPTADO',
          codigo_respuesta: details?.sunatResponseCode || '0',
          mensaje_respuesta: details?.sunatDescription || 'Aceptado por SUNAT',
          aceptado_at: new Date(),
        },
      });
    } else {
      await this.prisma.comprobantes_electronicos.update({
        where: { id: comprobanteId },
        data: {
          estado: 'RECHAZADO',
          codigo_respuesta: details?.sunatResponseCode || 'ERROR_ENVIO',
          mensaje_respuesta:
            details?.error || 'Fallo en la transmisión a SUNAT',
          rechazado_at: new Date(),
        },
      });
    }
  }
}
