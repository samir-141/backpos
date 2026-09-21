import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmitirComprobanteDto } from '../dtos/emitir-comprobante.dto';
import { TipoDocumentoSunat } from '../sunat/catalogos.enum';
import { motivoBloqueoEmision } from '../domain/emision-permitida.domain';
import { SUNAT_A_TIPO_SERIE } from './correlativos.service';
import type {
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

export interface EmisorConfigData {
  id?: string;
  perfil_tributario_id?: string;
  ruc: string;
  razon_social: string;
  nombre_comercial?: string | null;
  codigo_pais?: string;
  direccion_fiscal: string;
  ubigeo?: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  regimen_tributario: string;
  sistema_emision?: string;
  proveedor_tipo?: string;
  ambiente: string;
  sol_usuario_encriptado?: string | null;
  sol_clave_encriptada?: string | null;
  certificado_nombre?: string | null;
  certificado_path?: string | null;
  certificado_clave_encriptada?: string | null;
  certificado_fecha_vencimiento?: Date | null;
  activo?: boolean;
}

export interface ContextoEmision {
  venta: VentaEmision;
  serie: series_documentos;
  configuracion: EmisorConfigData;
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
  private readonly logger = new Logger(ComprobanteValidationService.name);

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

    // 9-11: resolución y validación del emisor / perfil tributario
    const perfilTargetId =
      dto.perfilTributarioId ||
      serie.perfil_tributario_id ||
      venta.perfil_tributario_id;

    let configuracion: EmisorConfigData | null = null;

    if (perfilTargetId && this.prisma.perfiles_tributarios?.findFirst) {
      const perfil = await this.prisma.perfiles_tributarios.findFirst({
        where: { id: perfilTargetId, botica_id: boticaId, deleted_at: null },
        include: { configuracion_emision: true },
      });
      if (perfil) {
        configuracion = {
          id: perfil.id,
          perfil_tributario_id: perfil.id,
          ruc: perfil.ruc,
          razon_social: perfil.razon_social,
          nombre_comercial: perfil.nombre_comercial,
          codigo_pais: 'PE',
          direccion_fiscal: perfil.direccion_fiscal,
          ubigeo: perfil.ubigeo,
          departamento: perfil.departamento,
          provincia: perfil.provincia,
          distrito: perfil.distrito,
          regimen_tributario: perfil.regimen_tributario,
          sistema_emision: perfil.configuracion_emision?.sistema_emision,
          proveedor_tipo: perfil.configuracion_emision?.proveedor_tipo,
          ambiente: perfil.configuracion_emision?.ambiente ?? 'BETA',
          sol_usuario_encriptado:
            perfil.configuracion_emision?.sol_usuario_encriptado,
          sol_clave_encriptada:
            perfil.configuracion_emision?.sol_clave_encriptada,
          certificado_nombre: perfil.configuracion_emision?.certificado_nombre,
          certificado_path: perfil.configuracion_emision?.certificado_path,
          certificado_clave_encriptada:
            perfil.configuracion_emision?.certificado_clave_encriptada,
          certificado_fecha_vencimiento:
            perfil.configuracion_emision?.certificado_fecha_vencimiento,
          activo:
            perfil.activo && (perfil.configuracion_emision?.activo ?? true),
        };
      }
    }

    // Fallback: perfil principal o legacy configuraciones_tributarias
    if (!configuracion && this.prisma.perfiles_tributarios?.findFirst) {
      const perfilPrincipal =
        (await this.prisma.perfiles_tributarios.findFirst({
          where: { botica_id: boticaId, es_principal: true, deleted_at: null },
          include: { configuracion_emision: true },
        })) ||
        (await this.prisma.perfiles_tributarios.findFirst({
          where: { botica_id: boticaId, deleted_at: null },
          include: { configuracion_emision: true },
        }));

      if (perfilPrincipal) {
        configuracion = {
          id: perfilPrincipal.id,
          perfil_tributario_id: perfilPrincipal.id,
          ruc: perfilPrincipal.ruc,
          razon_social: perfilPrincipal.razon_social,
          nombre_comercial: perfilPrincipal.nombre_comercial,
          codigo_pais: 'PE',
          direccion_fiscal: perfilPrincipal.direccion_fiscal,
          ubigeo: perfilPrincipal.ubigeo,
          departamento: perfilPrincipal.departamento,
          provincia: perfilPrincipal.provincia,
          distrito: perfilPrincipal.distrito,
          regimen_tributario: perfilPrincipal.regimen_tributario,
          sistema_emision:
            perfilPrincipal.configuracion_emision?.sistema_emision,
          proveedor_tipo: perfilPrincipal.configuracion_emision?.proveedor_tipo,
          ambiente: perfilPrincipal.configuracion_emision?.ambiente ?? 'BETA',
          sol_usuario_encriptado:
            perfilPrincipal.configuracion_emision?.sol_usuario_encriptado,
          sol_clave_encriptada:
            perfilPrincipal.configuracion_emision?.sol_clave_encriptada,
          certificado_nombre:
            perfilPrincipal.configuracion_emision?.certificado_nombre,
          certificado_path:
            perfilPrincipal.configuracion_emision?.certificado_path,
          certificado_clave_encriptada:
            perfilPrincipal.configuracion_emision?.certificado_clave_encriptada,
          certificado_fecha_vencimiento:
            perfilPrincipal.configuracion_emision
              ?.certificado_fecha_vencimiento,
          activo:
            perfilPrincipal.activo &&
            (perfilPrincipal.configuracion_emision?.activo ?? true),
        };
      }
    }

    if (!configuracion && this.prisma.configuraciones_tributarias?.findFirst) {
      const legacyCfg = await this.prisma.configuraciones_tributarias.findFirst(
        {
          where: { botica_id: boticaId, deleted_at: null },
        },
      );
      if (legacyCfg) {
        configuracion = {
          id: legacyCfg.id,
          ruc: legacyCfg.ruc,
          razon_social: legacyCfg.razon_social,
          nombre_comercial: legacyCfg.nombre_comercial,
          codigo_pais: legacyCfg.codigo_pais || 'PE',
          direccion_fiscal: legacyCfg.direccion_fiscal,
          ubigeo: legacyCfg.ubigeo,
          departamento: legacyCfg.departamento,
          provincia: legacyCfg.provincia,
          distrito: legacyCfg.distrito,
          regimen_tributario: legacyCfg.regimen_tributario,
          sistema_emision: 'SEE_CONTRIBUYENTE',
          proveedor_tipo: legacyCfg.proveedor_facturacion,
          ambiente: legacyCfg.ambiente,
          sol_usuario_encriptado: legacyCfg.sol_usuario_encriptado,
          sol_clave_encriptada: legacyCfg.sol_clave_encriptada,
          certificado_nombre: legacyCfg.certificado_nombre,
          certificado_path: legacyCfg.certificado_path,
          certificado_clave_encriptada: legacyCfg.certificado_clave_encriptada,
          certificado_fecha_vencimiento:
            legacyCfg.certificado_fecha_vencimiento,
          activo: legacyCfg.activo ?? true,
        };
      }
    }

    if (!configuracion || !configuracion.activo) {
      this.logger.warn(
        `Emisión bloqueada: sin configuración tributaria activa para botica ${boticaId}`,
      );
      throw new BadRequestException(
        'La empresa no tiene configuración tributaria activa',
      );
    }

    if (
      configuracion.certificado_fecha_vencimiento &&
      configuracion.certificado_fecha_vencimiento < new Date()
    ) {
      this.logger.warn(
        `Emisión bloqueada: certificado digital vencido para botica ${boticaId}`,
      );
      throw new BadRequestException('El certificado digital está vencido');
    }

    // 17: régimen tributario compatible (matriz de emisión por régimen/RUC)
    const motivoBloqueo = motivoBloqueoEmision(
      configuracion.regimen_tributario,
      dto.tipoComprobante,
    );
    if (motivoBloqueo) {
      this.logger.warn(
        `Emisión bloqueada por régimen: ${motivoBloqueo} (botica ${boticaId})`,
      );
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
      !['1', '4', '6'].includes(clienteTipoDoc)
    ) {
      throw new BadRequestException(
        'Para boletas de S/ 700.00 o más se requiere cliente con DNI, RUC o CE',
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
  validarParaEnvio(configuracion: EmisorConfigData): void {
    const reqCert =
      configuracion.regimen_tributario !== 'NRUS' &&
      configuracion.regimen_tributario !== 'NUEVO_RUS' &&
      configuracion.sistema_emision !== 'SEE_CF' &&
      configuracion.sistema_emision !== 'MANUAL';

    if (
      (!configuracion.sol_usuario_encriptado ||
        !configuracion.sol_clave_encriptada) &&
      configuracion.sistema_emision !== 'MANUAL' &&
      configuracion.sistema_emision !== 'SEE_CF'
    ) {
      throw new BadRequestException(
        'Faltan credenciales SOL en la configuración tributaria',
      );
    }

    if (
      reqCert &&
      (!configuracion.certificado_path ||
        !configuracion.certificado_clave_encriptada)
    ) {
      throw new BadRequestException(
        'Falta el certificado digital en la configuración tributaria',
      );
    }
  }
}
