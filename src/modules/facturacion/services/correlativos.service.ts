import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

/** Mapeo entre el tipo de documento de la tabla series y el catálogo 01 SUNAT. */
export const TIPO_SERIE_A_SUNAT: Record<string, string> = {
  BOLETA: '03',
  FACTURA: '01',
  NOTA_CREDITO: '07',
  NOTA_DEBITO: '08',
};

export const SUNAT_A_TIPO_SERIE: Record<string, string> = {
  '03': 'BOLETA',
  '01': 'FACTURA',
  '07': 'NOTA_CREDITO',
  '08': 'NOTA_DEBITO',
};

export interface CorrelativoReservado {
  serieId: string;
  serie: string;
  correlativo: number;
  tipoDocumento: string;
}

/**
 * Reserva atómica de correlativos sobre `series_documentos`.
 * Usa un único UPDATE con bloqueo de fila: dos cajas concurrentes nunca
 * obtienen el mismo número y los correlativos fallidos no se reutilizan.
 */
@Injectable()
export class CorrelativosService {
  /**
   * Incrementa y devuelve el correlativo de una serie.
   * Debe ejecutarse dentro de una transacción Prisma ($transaction).
   * `correlativo_actual` se interpreta como el SIGUIENTE número disponible.
   */
  async reservarSiguiente(
    tx: Prisma.TransactionClient,
    boticaId: string,
    serieId: string,
  ): Promise<CorrelativoReservado> {
    const filas = await tx.$queryRaw<
      Array<{
        id: string;
        serie: string;
        correlativo_asignado: number;
        tipo_documento: string;
      }>
    >(Prisma.sql`
      UPDATE series_documentos
      SET correlativo_actual = correlativo_actual + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${serieId}::uuid
        AND botica_id = ${boticaId}::uuid
        AND activo = true
      RETURNING id, serie, (correlativo_actual - 1) AS correlativo_asignado, tipo_documento
    `);

    if (!filas.length) {
      const existe = await tx.series_documentos.findFirst({
        where: { id: serieId, botica_id: boticaId },
      });
      if (!existe) {
        throw new NotFoundException(
          'La serie no existe o no pertenece a la empresa',
        );
      }
      throw new BadRequestException('La serie está inactiva');
    }

    const fila = filas[0];
    return {
      serieId: fila.id,
      serie: fila.serie,
      correlativo: Number(fila.correlativo_asignado),
      tipoDocumento: fila.tipo_documento,
    };
  }
}
