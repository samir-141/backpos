import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { XmlBuilderService } from '../builders/xml-builder.service';
import { FirmaService } from '../firma/firma.service';
import { SunatSoapClient, CredencialesSol } from '../sunat/sunat-soap.client';
import { CdrParserService } from '../cdr/cdr-parser.service';
import { ZipService } from '../zip/zip.service';
import { ComprobanteStorageService } from '../storage/comprobante-storage.service';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import { CorrelativosService } from './correlativos.service';
import { ComprobanteValidationService } from './comprobante-validation.service';
import { VentaToComprobanteMapper } from '../mappers/venta-to-comprobante.mapper';
import { EmitirComprobanteDto } from '../dtos/emitir-comprobante.dto';
import {
  EstadoComprobante,
  ESTADOS_REINTENTABLES,
} from '../domain/estado-comprobante.enum';
import {
  ComprobanteSunatData,
  nombreArchivoComprobante,
} from '../domain/comprobante-data.interface';
import { numeroALetras } from '../utils/numero-a-letras.util';
import type {
  comprobantes_electronicos,
  comprobantes_electronicos_detalles,
  configuraciones_tributarias,
} from '../../../generated/prisma/client';

type ComprobanteConDetalles = comprobantes_electronicos & {
  detalles: comprobantes_electronicos_detalles[];
};

const ESTADOS_FINALES: ReadonlySet<string> = new Set([
  EstadoComprobante.ACEPTADO,
  EstadoComprobante.ACEPTADO_CON_OBSERVACIONES,
  EstadoComprobante.RECHAZADO,
]);

/**
 * Orquestador del ciclo de vida del comprobante electrónico:
 * validación → correlativo → persistencia → XML → firma → ZIP →
 * envío SOAP → CDR → PDF. La venta nunca se pierde si SUNAT falla:
 * el comprobante queda en estado reintentable.
 */
@Injectable()
export class FacturacionService {
  private readonly logger = new Logger(FacturacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptionService,
    private readonly xmlBuilder: XmlBuilderService,
    private readonly firma: FirmaService,
    private readonly soap: SunatSoapClient,
    private readonly cdrParser: CdrParserService,
    private readonly zip: ZipService,
    private readonly storage: ComprobanteStorageService,
    private readonly pdf: PdfGeneratorService,
    private readonly correlativos: CorrelativosService,
    private readonly validation: ComprobanteValidationService,
    private readonly mapper: VentaToComprobanteMapper,
  ) {}

  /**
   * Crea el comprobante (transaccional) y luego ejecuta el pipeline
   * de envío fuera de la transacción de base de datos.
   */
  async emitir(
    dto: EmitirComprobanteDto,
    boticaId: string,
    sucursalId: string | undefined,
    usuarioId: string,
  ) {
    const ctx = await this.validation.validarYObtenerContexto(
      dto,
      boticaId,
      sucursalId,
    );

    const comprobante = await this.prisma.$transaction(async (tx) => {
      const reserva = await this.correlativos.reservarSiguiente(
        tx,
        boticaId,
        dto.serieId,
      );

      const data = this.mapper.map(ctx, {
        tipoComprobante: dto.tipoComprobante,
        serie: reserva.serie,
        correlativo: reserva.correlativo,
        fechaEmision: new Date(),
        moneda: 'PEN',
        formaPago: 'CONTADO',
      });
      const nombreArchivo = nombreArchivoComprobante(data);

      const creado = await tx.comprobantes_electronicos.create({
        data: {
          botica_id: boticaId,
          sucursal_id: ctx.venta.cajas.sucursal_id,
          venta_id: ctx.venta.id,
          cliente_id: ctx.venta.cliente_id,
          serie_id: reserva.serieId,
          tipo_comprobante: dto.tipoComprobante,
          serie: reserva.serie,
          correlativo: reserva.correlativo,
          nombre_archivo: nombreArchivo,
          fecha_emision: data.documento.fechaEmision,
          moneda: data.documento.moneda,
          forma_pago: data.documento.formaPago,
          cliente_tipo_documento: data.cliente.tipoDocumento,
          cliente_numero_documento: data.cliente.numeroDocumento,
          cliente_razon_social: data.cliente.razonSocial,
          cliente_direccion: data.cliente.direccion,
          total_gravado: data.totales.totalGravado,
          total_exonerado: data.totales.totalExonerado,
          total_inafecto: data.totales.totalInafecto,
          total_gratuito: data.totales.totalGratuito,
          total_descuentos: data.totales.totalDescuentos,
          total_igv: data.totales.totalIgv,
          subtotal: data.totales.subtotal,
          total: data.totales.total,
          estado: EstadoComprobante.PENDIENTE,
          created_by: usuarioId,
          detalles: {
            create: data.items.map((item) => ({
              codigo_producto: item.codigoProducto,
              descripcion: item.descripcion,
              unidad_medida: item.unidadMedida,
              cantidad: item.cantidad,
              valor_unitario: item.valorUnitario,
              precio_unitario: item.precioUnitario,
              valor_venta: item.valorVenta,
              descuento: item.descuento,
              codigo_afectacion_igv: item.codigoAfectacionIgv,
              porcentaje_igv: item.porcentajeIgv,
              monto_igv: item.montoIgv,
              importe_total: item.importeTotal,
            })),
          },
        },
        include: { detalles: true },
      });

      return creado;
    });

    await this.audit.registrar({
      usuario_id: usuarioId,
      accion: 'COMPROBANTE_CREADO',
      tabla: 'comprobantes_electronicos',
      registros_afectados: 1,
      botica_id: boticaId,
      observacion: `${comprobante.serie}-${comprobante.correlativo} venta ${ctx.venta.id}`,
    });

    // Pipeline de envío fuera de la transacción (SUNAT puede demorar).
    const procesado = await this.procesarEnvio(comprobante.id, boticaId);
    return this.respuesta(procesado);
  }

  /**
   * Ejecuta (o reanuda) el pipeline de envío de un comprobante.
   * Idempotente: si ya está aceptado no reenvía; si falló, reutiliza
   * el XML firmado y el ZIP ya generados (nunca nuevo correlativo).
   */
  async procesarEnvio(
    comprobanteId: string,
    boticaId: string,
  ): Promise<ComprobanteConDetalles> {
    // Claim atómico para evitar envíos simultáneos del mismo comprobante
    const reclamado = await this.prisma.comprobantes_electronicos.updateMany({
      where: {
        id: comprobanteId,
        botica_id: boticaId,
        estado: { in: [...ESTADOS_REINTENTABLES] },
      },
      data: { estado: EstadoComprobante.ENVIANDO },
    });
    if (!reclamado.count) {
      const actual = await this.obtener(comprobanteId, boticaId);
      if (ESTADOS_FINALES.has(actual.estado)) {
        return actual; // ya procesado: idempotencia
      }
      throw new ConflictException(
        `El comprobante está en estado ${actual.estado} (envío en curso o no reintentable)`,
      );
    }

    const comp = await this.obtener(comprobanteId, boticaId);
    const config = await this.obtenerConfiguracion(boticaId);

    try {
      this.validation.validarParaEnvio(config);
      const data = this.mapDesdeRegistro(comp, config);
      const dir = this.storage.directorioComprobante(
        config.ruc,
        comp.fecha_emision,
        comp.nombre_archivo,
      );

      // 1. XML (solo si no existe)
      let xmlFirmadoPath = comp.xml_firmado_path;
      let hash = comp.hash ?? '';
      if (!xmlFirmadoPath) {
        const xml = this.xmlBuilder.buildInvoice(data);
        const xmlPath = await this.storage.guardarXml(dir, xml);

        const certBuffer = await this.storage.leer(
          config.certificado_path ?? '',
        );
        const cert = this.firma.extraerCertificado(
          certBuffer,
          this.encryption.decrypt(config.certificado_clave_encriptada ?? ''),
        );
        const firma = this.firma.firmarXml(
          xml,
          cert.privateKeyPem,
          cert.certBase64,
        );
        xmlFirmadoPath = await this.storage.guardarXmlFirmado(
          dir,
          firma.xmlFirmado,
        );
        hash = firma.digestValue;
        await this.prisma.comprobantes_electronicos.update({
          where: { id: comp.id },
          data: {
            xml_path: xmlPath,
            xml_firmado_path: xmlFirmadoPath,
            hash,
            estado: EstadoComprobante.FIRMADO,
          },
        });
      }

      // 2. ZIP (solo si no existe)
      let zipPath = comp.zip_path;
      if (!zipPath) {
        const xmlFirmado = await this.storage.leer(xmlFirmadoPath);
        const zipBuffer = this.zip.comprimirXml(
          comp.nombre_archivo,
          xmlFirmado,
        );
        zipPath = await this.storage.guardarZip(dir, zipBuffer);
        await this.prisma.comprobantes_electronicos.update({
          where: { id: comp.id },
          data: { zip_path: zipPath, estado: EstadoComprobante.COMPRIMIDO },
        });
      }

      // 3. Envío SOAP con registro de intento
      const numeroIntento =
        (await this.prisma.comprobantes_intentos_envio.count({
          where: { comprobante_id: comp.id },
        })) + 1;
      const intento = await this.prisma.comprobantes_intentos_envio.create({
        data: {
          comprobante_id: comp.id,
          numero_intento: numeroIntento,
          ambiente: config.ambiente,
          endpoint: this.soap.endpointPara(config.ambiente),
          estado: 'INICIADO',
        },
      });

      const credenciales: CredencialesSol = {
        ruc: config.ruc,
        usuario: this.encryption.decrypt(config.sol_usuario_encriptado ?? ''),
        clave: this.encryption.decrypt(config.sol_clave_encriptada ?? ''),
      };
      const zipBuffer = await this.storage.leer(zipPath);
      const envio = await this.soap.sendBill(
        config.ambiente,
        credenciales,
        `${comp.nombre_archivo}.zip`,
        zipBuffer,
      );

      if (!envio.exito || !envio.cdrZipBase64) {
        await this.finalizarIntento(intento.id, {
          estado: 'ERROR',
          codigo_http: envio.codigoHttp,
          codigo_respuesta: envio.codigoError,
          mensaje_respuesta: envio.mensajeError,
        });
        const estado =
          envio.codigoHttp === 0
            ? EstadoComprobante.ERROR_ENVIO
            : EstadoComprobante.ERROR_RESPUESTA;
        return await this.actualizarEstado(comp.id, {
          estado,
          codigo_respuesta: envio.codigoError,
          mensaje_respuesta: envio.mensajeError,
          enviado_at: new Date(),
        });
      }

      // 4. CDR
      const cdrZip = Buffer.from(envio.cdrZipBase64, 'base64');
      const cdr = this.cdrParser.parsear(cdrZip);
      const cdrZipPath = await this.storage.guardarCdrZip(dir, cdrZip);
      const cdrXmlPath = await this.storage.guardarCdrXml(dir, cdr.cdrXml);

      await this.finalizarIntento(intento.id, {
        estado: 'COMPLETADO',
        codigo_http: envio.codigoHttp,
        codigo_respuesta: cdr.codigoRespuesta,
        mensaje_respuesta: cdr.descripcion,
      });

      const actualizado = await this.actualizarEstado(comp.id, {
        estado: cdr.estado,
        codigo_respuesta: cdr.codigoRespuesta,
        mensaje_respuesta: cdr.descripcion,
        observaciones: cdr.observaciones,
        cdr_zip_path: cdrZipPath,
        cdr_xml_path: cdrXmlPath,
        enviado_at: new Date(),
        aceptado_at:
          cdr.estado === EstadoComprobante.ACEPTADO ||
          cdr.estado === EstadoComprobante.ACEPTADO_CON_OBSERVACIONES
            ? new Date()
            : undefined,
        rechazado_at:
          cdr.estado === EstadoComprobante.RECHAZADO ? new Date() : undefined,
      });

      // 5. PDF (no bloquea el resultado si falla)
      try {
        const pdfBuffer = await this.pdf.generarPdf(
          data,
          { hash, estado: cdr.estado },
          'A4',
        );
        const pdfPath = await this.storage.guardarPdf(dir, pdfBuffer);
        await this.prisma.comprobantes_electronicos.update({
          where: { id: comp.id },
          data: { pdf_path: pdfPath },
        });
        actualizado.pdf_path = pdfPath;
      } catch (error) {
        this.logger.warn(
          `No se pudo generar el PDF de ${comp.nombre_archivo}: ${(error as Error).message}`,
        );
      }

      await this.audit.registrar({
        accion:
          cdr.estado === EstadoComprobante.RECHAZADO
            ? 'COMPROBANTE_RECHAZADO'
            : 'COMPROBANTE_ACEPTADO',
        tabla: 'comprobantes_electronicos',
        registros_afectados: 1,
        botica_id: boticaId,
        observacion:
          `${comp.serie}-${comp.correlativo}: ${cdr.codigoRespuesta} ${cdr.descripcion}`.slice(
            0,
            500,
          ),
      });

      return actualizado;
    } catch (error) {
      this.logger.error(
        `Fallo el pipeline de ${comp.nombre_archivo}: ${(error as Error).message}`,
      );
      await this.actualizarEstado(comp.id, {
        estado: EstadoComprobante.ERROR_LOCAL,
        mensaje_respuesta: (error as Error).message.slice(0, 500),
      });
      throw error;
    }
  }

  /** Reintento manual desde la API. Mismo comprobante, mismos artefactos. */
  async reintentar(comprobanteId: string, boticaId: string, usuarioId: string) {
    const resultado = await this.procesarEnvio(comprobanteId, boticaId);
    await this.audit.registrar({
      usuario_id: usuarioId,
      accion: 'COMPROBANTE_REINTENTO',
      tabla: 'comprobantes_electronicos',
      registros_afectados: 1,
      botica_id: boticaId,
      observacion: `${resultado.serie}-${resultado.correlativo} → ${resultado.estado}`,
    });
    return this.respuesta(resultado);
  }

  async listar(
    boticaId: string,
    filtros: {
      estado?: string;
      tipo?: string;
      sucursalId?: string;
      pagina?: number;
      limite?: number;
    },
  ) {
    const pagina = Math.max(1, filtros.pagina ?? 1);
    const limite = Math.min(100, Math.max(1, filtros.limite ?? 20));
    const where = {
      botica_id: boticaId,
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.tipo ? { tipo_comprobante: filtros.tipo } : {}),
      ...(filtros.sucursalId ? { sucursal_id: filtros.sucursalId } : {}),
    };
    const [total, filas] = await this.prisma.$transaction([
      this.prisma.comprobantes_electronicos.count({ where }),
      this.prisma.comprobantes_electronicos.findMany({
        where,
        orderBy: { fecha_emision: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
      }),
    ]);
    return { total, pagina, limite, datos: filas.map((f) => this.resumen(f)) };
  }

  async obtener(
    comprobanteId: string,
    boticaId: string,
  ): Promise<ComprobanteConDetalles> {
    const comp = await this.prisma.comprobantes_electronicos.findFirst({
      where: { id: comprobanteId, botica_id: boticaId },
      include: { detalles: true },
    });
    if (!comp) {
      throw new NotFoundException('Comprobante no encontrado');
    }
    return comp;
  }

  async detalle(comprobanteId: string, boticaId: string) {
    return this.respuesta(await this.obtener(comprobanteId, boticaId));
  }

  async descargarArchivo(
    comprobanteId: string,
    boticaId: string,
    tipo: 'xml' | 'cdr' | 'pdf',
  ): Promise<{ buffer: Buffer; nombre: string; contentType: string }> {
    const comp = await this.obtener(comprobanteId, boticaId);
    const ruta =
      tipo === 'xml'
        ? comp.xml_firmado_path
        : tipo === 'cdr'
          ? comp.cdr_xml_path
          : comp.pdf_path;
    if (!ruta) {
      throw new NotFoundException(
        `El comprobante no tiene ${tipo.toUpperCase()} disponible`,
      );
    }
    const buffer = await this.storage.leer(ruta);
    const extension = tipo === 'pdf' ? 'pdf' : 'xml';
    return {
      buffer,
      nombre: `${comp.nombre_archivo}${tipo === 'cdr' ? '-cdr' : ''}.${extension}`,
      contentType: tipo === 'pdf' ? 'application/pdf' : 'application/xml',
    };
  }

  // ---------------------------------------------------------------- privados

  private async obtenerConfiguracion(
    boticaId: string,
  ): Promise<configuraciones_tributarias> {
    const config = await this.prisma.configuraciones_tributarias.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });
    if (!config) {
      throw new NotFoundException(
        'La empresa no tiene configuración tributaria',
      );
    }
    return config;
  }

  private async actualizarEstado(
    id: string,
    data: Record<string, unknown>,
  ): Promise<ComprobanteConDetalles> {
    return this.prisma.comprobantes_electronicos.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
      include: { detalles: true },
    });
  }

  private async finalizarIntento(
    intentoId: string,
    data: {
      estado: string;
      codigo_http: number;
      codigo_respuesta?: string;
      mensaje_respuesta?: string;
    },
  ) {
    await this.prisma.comprobantes_intentos_envio.update({
      where: { id: intentoId },
      data: { ...data, finalizado_at: new Date() },
    });
  }

  /** Reconstruye la estructura de dominio desde la fotografía en BD. */
  private mapDesdeRegistro(
    comp: ComprobanteConDetalles,
    config: configuraciones_tributarias,
  ): ComprobanteSunatData {
    return {
      emisor: {
        ruc: config.ruc,
        razonSocial: config.razon_social,
        nombreComercial: config.nombre_comercial ?? undefined,
        ubigeo: config.ubigeo ?? undefined,
        direccion: config.direccion_fiscal,
        departamento: config.departamento ?? undefined,
        provincia: config.provincia ?? undefined,
        distrito: config.distrito ?? undefined,
        codigoPais: config.codigo_pais,
      },
      cliente: {
        tipoDocumento: comp.cliente_tipo_documento ?? '0',
        numeroDocumento: comp.cliente_numero_documento ?? '0',
        razonSocial: comp.cliente_razon_social ?? 'CLIENTES VARIOS',
        direccion: comp.cliente_direccion ?? undefined,
      },
      documento: {
        tipoComprobante: comp.tipo_comprobante,
        serie: comp.serie,
        correlativo: comp.correlativo,
        fechaEmision: comp.fecha_emision,
        moneda: comp.moneda,
        formaPago: comp.forma_pago,
      },
      items: comp.detalles.map((d) => ({
        codigoProducto: d.codigo_producto ?? undefined,
        descripcion: d.descripcion,
        unidadMedida: d.unidad_medida,
        cantidad: Number(d.cantidad),
        valorUnitario: Number(d.valor_unitario),
        precioUnitario: Number(d.precio_unitario),
        valorVenta: Number(d.valor_venta),
        descuento: Number(d.descuento),
        codigoAfectacionIgv: d.codigo_afectacion_igv,
        porcentajeIgv: Number(d.porcentaje_igv),
        montoIgv: Number(d.monto_igv),
        importeTotal: Number(d.importe_total),
      })),
      totales: {
        totalGravado: Number(comp.total_gravado),
        totalExonerado: Number(comp.total_exonerado),
        totalInafecto: Number(comp.total_inafecto),
        totalGratuito: Number(comp.total_gratuito),
        totalDescuentos: Number(comp.total_descuentos),
        totalIgv: Number(comp.total_igv),
        subtotal: Number(comp.subtotal),
        total: Number(comp.total),
        montoEnLetras: numeroALetras(Number(comp.total)),
      },
    };
  }

  private resumen(comp: comprobantes_electronicos) {
    return {
      id: comp.id,
      tipo_comprobante: comp.tipo_comprobante,
      serie: comp.serie,
      correlativo: comp.correlativo,
      numero: `${comp.serie}-${comp.correlativo}`,
      cliente_numero_documento: comp.cliente_numero_documento,
      cliente_razon_social: comp.cliente_razon_social,
      total: Number(comp.total),
      moneda: comp.moneda,
      fecha_emision: comp.fecha_emision,
      estado: comp.estado,
      codigo_respuesta: comp.codigo_respuesta,
      mensaje_respuesta: comp.mensaje_respuesta,
      venta_id: comp.venta_id,
    };
  }

  private respuesta(comp: ComprobanteConDetalles) {
    return {
      ...this.resumen(comp),
      hash: comp.hash,
      observaciones: comp.observaciones,
      tiene_xml: Boolean(comp.xml_firmado_path),
      tiene_cdr: Boolean(comp.cdr_xml_path),
      tiene_pdf: Boolean(comp.pdf_path),
      detalles: comp.detalles.map((d) => ({
        descripcion: d.descripcion,
        cantidad: Number(d.cantidad),
        precio_unitario: Number(d.precio_unitario),
        monto_igv: Number(d.monto_igv),
        importe_total: Number(d.importe_total),
      })),
    };
  }
}
