// src/modules/audit/audit.service.ts
// Servicio de Auditoría del Backend (Sección 23 del Documento 02 de Arquitectura)

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LogAuditParams {
  usuario_id?: string;
  accion: string;
  tabla?: string;
  registros_afectados?: number;
  ip?: string;
  dispositivo?: string;
  observacion?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(params: LogAuditParams & { botica_id?: string }) {
    const {
      usuario_id,
      accion,
      tabla = 'general',
      registros_afectados = 1,
      ip = '127.0.0.1',
      dispositivo = 'PC',
      observacion,
      botica_id,
    } = params;

    const textoObs = `[User: ${usuario_id || 'SISTEMA'}] [Botica: ${botica_id || 'N/A'}] [IP: ${ip}] [Dev: ${dispositivo}] ${accion}${observacion ? ` - ${observacion}` : ''}`;

    this.logger.log(`[AUDIT] ${textoObs}`);

    if (!botica_id) {
      this.logger.warn(
        '[AUDIT] No se registró log de auditoría: botica_id no proporcionado',
      );
      return;
    }

    try {
      await this.prisma.migracion_log.create({
        data: {
          botica_id,
          tabla: tabla.substring(0, 100),
          operacion: accion.substring(0, 50),
          registros_afectados,
          observacion: textoObs,
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `No se pudo persistir log de auditoría en la BD: ${err.message}`,
      );
    }
  }
}
