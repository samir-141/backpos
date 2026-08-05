import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmitirComprobanteDto } from '../dtos/emitir-comprobante.dto';
import { TipoDocumentoSunat } from '../sunat/catalogos.enum';
import { motivoBloqueoEmision } from '../domain/emision-permitida.domain';
import { SUNAT_A_TIPO_SERIE } from './correlativos.service';
import type {
  configuraciones_tributarias,
  series_documentos,
  ventas,
  clientes,
  detalles_ventas,
  productos_presentaciones,
  productos_comerciales,
  medicamentos,
  cajas,
} from '../../../generated/prisma/client';

export type VentaEmision = ventas & {
  clientes: clientes | null;
  cajas: cajas;
  detalles_ventas: Array<
    detalles_ventas & {
      productos_presentaciones: productos_presentaciones & {
        productos_comerciales: productos_comerciales & {
          medicamentos: medicamentos | null;
        };
      };
    }
  >;
};

export interface ContextoEmision {
  venta: VentaEmision;
  serie: series_documentos;
  configuracion: configuraciones_tributarias;
}

/** Mapeo del tipo de documento del cliente (texto libre POS) al catálogo 06. */
export function mapearTipoDocumentoIdentidad(
  tipo: string | null | undefined,
): string {
  switch ((tipo ?? '').trim().toUpperCase()) {
    case 'DNI':
      return '1';
    case 'RUC':
      return '6';
    case 'CE':
    case 'CARNET_EXTRANJERIA':
      return '4';
    case 'PASAPORTE':
      return '7';
    default:
      return '0';
  }
}

/**
 * Validaciones previas a la emisión de un comprobante electrónico.
 * Carga y devuelve el contexto completo para no repetir consultas.
 */
@Injectable()
export class ComprobanteValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validarYObtenerContexto(
    dto: EmitirComprobanteDto,
    boticaId: string,
    sucursalId?: string,
  ): Promise<ContextoEmision> {
    // 1-6: venta existente, de la empresa/sucursal, cerrada y no anulada
    const venta = await this.prisma.ventas.findFirst({
      where: { id: dto.ventaId, botica_id: boticaId, deleted_at: null },
      include: {
        clientes: true,
        cajas: true,
        detalles_ventas: {
          include: {
            productos_presentaciones: {
              include: {
                productos_comerciales: { include: { medicamentos: true } },
              },
            },
          },
        },
      },
    });

    if (!venta) {
      throw new NotFoundException(
        'La venta no existe o no pertenece a la empresa',
      );
    }
    if (sucursalId && venta.cajas.sucursal_id !== sucursalId) {
      throw new BadRequestException(
        'La venta no pertenece a la sucursal indicada',
      );
    }
    if (venta.estado !== 'EMITIDO') {
      throw new BadRequestException(
        `No se puede emitir comprobante de una venta en estado ${venta.estado}`,
      );
    }

    // 6: sin comprobante duplicado del mismo tipo
    const duplicado = await this.prisma.comprobantes_electronicos.findFirst({
      where: { venta_id: venta.id, tipo_comprobante: dto.tipoComprobante },
    });
    if (duplicado) {
      throw new ConflictException(
        `La venta ya tiene el comprobante ${duplicado.serie}-${duplicado.correlativo} (${duplicado.estado})`,
      );
    }

    // 7-8: serie activa y coherente con el tipo solicitado
    const serie = await this.prisma.series_documentos.findFirst({
      where: { id: dto.serieId, botica_id: boticaId },
    });
    if (!serie) {
      throw new NotFoundException(
        'La serie no existe o no pertenece a la empresa',
      );
    }
    if (!serie.activo) {
      throw new BadRequestException('La serie está inactiva');
    }
    const tipoEsperado = SUNAT_A_TIPO_SERIE[dto.tipoComprobante];
    if (serie.tipo_documento !== tipoEsperado) {
      throw new BadRequestException(
        `La serie ${serie.serie} es de tipo ${serie.tipo_documento}; no corresponde al comprobante ${dto.tipoComprobante}`,
      );
    }

    // 9-11: configuración tributaria completa
    const configuracion =
      await this.prisma.configuraciones_tributarias.findFirst({
        where: { botica_id: boticaId, deleted_at: null },
      });
    if (!configuracion || !configuracion.activo) {
      throw new BadRequestException(
        'La empresa no tiene configuración tributaria activa',
      );
    }
    if (
      configuracion.certificado_fecha_vencimiento &&
      configuracion.certificado_fecha_vencimiento < new Date()
    ) {
      throw new BadRequestException('El certificado digital está vencido');
    }

    // 17: régimen tributario compatible (matriz de emisión por régimen/RUC)
    const motivoBloqueo = motivoBloqueoEmision(
      configuracion.regimen_tributario,
      dto.tipoComprobante,
    );
    if (motivoBloqueo) {
      throw new BadRequestException(motivoBloqueo);
    }

    // 12: cliente válido según tipo de comprobante
    const clienteTipoDoc = mapearTipoDocumentoIdentidad(
      venta.clientes?.tipo_documento,
    );
    if (dto.tipoComprobante === (TipoDocumentoSunat.FACTURA as string)) {
      const numeroDoc = venta.clientes?.numero_documento ?? '';
      if (clienteTipoDoc !== '6' || numeroDoc.length !== 11) {
        throw new BadRequestException(
          'Para emitir una Factura (01) el cliente debe tener RUC de 11 dígitos',
        );
      }
    }
    if (
      dto.tipoComprobante === (TipoDocumentoSunat.BOLETA as string) &&
      Number(venta.total) >= 700 &&
      !['1', '4'].includes(clienteTipoDoc)
    ) {
      throw new BadRequestException(
        'Para boletas de S/ 700.00 o más se requiere cliente con DNI o CE',
      );
    }

    // 13-15: ítems con descripción y cantidades positivas
    if (!venta.detalles_ventas.length) {
      throw new BadRequestException('La venta no tiene ítems');
    }
    for (const detalle of venta.detalles_ventas) {
      const nombre =
        detalle.productos_presentaciones.productos_comerciales.nombre_comercial;
      if (!nombre?.trim()) {
        throw new BadRequestException(
          'Hay productos sin descripción en la venta',
        );
      }
      if (!(detalle.cantidad > 0)) {
        throw new BadRequestException(
          `El producto ${nombre} tiene cantidad inválida`,
        );
      }
    }

    return { venta, serie, configuracion };
  }

  /** Credenciales y certificado son obligatorios recién al ENVIAR a SUNAT. */
  validarParaEnvio(configuracion: configuraciones_tributarias): void {
    if (
      !configuracion.sol_usuario_encriptado ||
      !configuracion.sol_clave_encriptada
    ) {
      throw new BadRequestException(
        'Faltan credenciales SOL en la configuración tributaria',
      );
    }
    if (
      !configuracion.certificado_path ||
      !configuracion.certificado_clave_encriptada
    ) {
      throw new BadRequestException(
        'Falta el certificado digital en la configuración tributaria',
      );
    }
  }
}
