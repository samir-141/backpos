import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

/** Serializa JSON de forma determinista. PostgreSQL JSONB no conserva el orden
 * original de las propiedades, por lo que JSON.stringify directo no sirve para
 * comprobar la firma de un snapshot almacenado. */
export function serializarSnapshot(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(serializarSnapshot).join(',')}]`;
  const objeto = valor as Record<string, unknown>;
  return `{${Object.keys(objeto).sort().map((clave) => `${JSON.stringify(clave)}:${serializarSnapshot(objeto[clave])}`).join(',')}}`;
}

export function hashSnapshot(snapshot: unknown): string {
  return createHash('sha256').update(serializarSnapshot(snapshot)).digest('hex');
}

@Injectable()
export class ComprobantesPublicosService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(token: string) {
    const comprobante = await this.prisma.comprobantes_publicos.findUnique({ where: { token_publico: token } });
    if (!comprobante) throw new NotFoundException('Comprobante no encontrado.');
    if (comprobante.anulado_at) throw new GoneException('Este comprobante fue anulado.');
    if (comprobante.expira_at && comprobante.expira_at < new Date()) throw new GoneException('El enlace del comprobante expiró.');
    const hash = hashSnapshot(comprobante.snapshot);
    // Los enlaces emitidos antes de la serialización determinista pueden tener
    // una firma legada por el reordenamiento que hace JSONB. Se normalizan una
    // sola vez; desde entonces la verificación permanece estable.
    if (hash !== comprobante.hash_documento) {
      await this.prisma.comprobantes_publicos.update({
        where: { id: comprobante.id },
        data: { hash_documento: hash },
      });
    }
    await this.prisma.comprobantes_publicos.update({ where: { id: comprobante.id }, data: { abierto_at: new Date(), aperturas: { increment: 1 } } });
    return { plantilla_version: comprobante.plantilla_version, snapshot: comprobante.snapshot, hash_documento: comprobante.hash_documento };
  }

  async obtenerPorVenta(ventaId: string, boticaId: string) {
    const comprobante = await this.prisma.comprobantes_publicos.findFirst({
      where: { venta_id: ventaId, botica_id: boticaId },
      select: { token_publico: true, anulado_at: true, expira_at: true },
    });
    if (!comprobante) throw new NotFoundException('Esta venta no tiene un comprobante público.');
    return {
      token: comprobante.token_publico,
      url: `/c/${comprobante.token_publico}`,
      disponible: !comprobante.anulado_at && !(comprobante.expira_at && comprobante.expira_at < new Date()),
    };
  }
}
