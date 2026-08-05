import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { FirmaService } from '../firma/firma.service';
import { SunatSoapClient, CredencialesSol } from '../sunat/sunat-soap.client';
import { CdrParserService } from '../cdr/cdr-parser.service';
import { ZipService } from '../zip/zip.service';
import { ComprobanteStorageService } from '../storage/comprobante-storage.service';
import { ResumenDiarioXmlBuilder } from '../builders/resumen-diario-xml.builder';
import { EstadoComprobante } from '../domain/estado-comprobante.enum';
import { TipoDocumentoSunat } from '../sunat/catalogos.enum';

function fmtFecha(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function soloFecha(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/**
 * Resumen diario de boletas (RC): agrupa las boletas pendientes de una
 * fecha, genera el XML, lo firma, lo envía con sendSummary y consulta
 * el ticket con getStatus hasta obtener la CDR.
 */
@Injectable()
export class ResumenDiarioService {
  private readonly logger = new Logger(ResumenDiarioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly encryption: EncryptionService,
    private readonly firma: FirmaService,
    private readonly soap: SunatSoapClient,
    private readonly cdrParser: CdrParserService,
    private readonly zip: ZipService,
    private readonly storage: ComprobanteStorageService,
    private readonly xmlBuilder: ResumenDiarioXmlBuilder,
  ) {}

  /** Genera el resumen de boletas PENDIENTE_RESUMEN de una fecha. */
  async generar(boticaId: string, fechaReferencia: Date, usuarioId: string) {
    await this.obtenerConfiguracion(boticaId); // valida configuración activa
    const fecha = soloFecha(fechaReferencia);

    const boletas = await this.prisma.comprobantes_electronicos.findMany({
      where: {
        botica_id: boticaId,
        tipo_comprobante: TipoDocumentoSunat.BOLETA,
        estado: EstadoComprobante.PENDIENTE_RESUMEN,
        fecha_emision: { gte: fecha, lt: new Date(fecha.getTime() + 86400000) },
      },
    });
    if (!boletas.length) {
      throw new BadRequestException(
        'No hay boletas pendientes de resumen en esa fecha',
      );
    }

    const resumen = await this.prisma.$transaction(async (tx) => {
      const ultimo = await tx.resumenes_diarios.findFirst({
        where: { botica_id: boticaId, fecha_referencia: fecha },
        orderBy: { correlativo: 'desc' },
      });
      const correlativo = (ultimo?.correlativo ?? 0) + 1;
      const identificador = `RC-${fmtFecha(fecha)}-${String(correlativo).padStart(3, '0')}`;

      const creado = await tx.resumenes_diarios.create({
        data: {
          botica_id: boticaId,
          sucursal_id: boletas[0].sucursal_id,
          fecha_referencia: fecha,
          identificador,
          correlativo,
          estado: 'PENDIENTE',
          created_by: usuarioId,
          detalles: {
            create: boletas.map((b) => ({
              comprobante_id: b.id,
              condicion: '1',
            })),
          },
        },
        include: { detalles: true },
      });

      // Marca las boletas como incluidas en un resumen
      await tx.comprobantes_electronicos.updateMany({
        where: { id: { in: boletas.map((b) => b.id) } },
        data: { estado: 'EN_RESUMEN', updated_at: new Date() },
      });

      return creado;
    });

    await this.audit.registrar({
      usuario_id: usuarioId,
      accion: 'RESUMEN_DIARIO_GENERADO',
      tabla: 'resumenes_diarios',
      registros_afectados: 1,
      botica_id: boticaId,
      observacion: `${resumen.identificador} con ${boletas.length} boletas`,
    });

    return resumen;
  }

  /** Firma y envía el resumen a SUNAT (sendSummary) guardando el ticket. */
  async enviar(resumenId: string, boticaId: string) {
    const resumen = await this.obtener(resumenId, boticaId);
    if (resumen.estado !== 'PENDIENTE' && resumen.estado !== 'ERROR_ENVIO') {
      throw new ConflictException(
        `El resumen está en estado ${resumen.estado}`,
      );
    }

    const config = await this.obtenerConfiguracion(boticaId);
    const detalles = await this.prisma.resumenes_diarios_detalles.findMany({
      where: { resumen_id: resumen.id },
      include: { comprobantes_electronicos: true },
    });

    const xml = this.xmlBuilder.build({
      emisor: {
        ruc: config.ruc,
        razonSocial: config.razon_social,
        direccion: config.direccion_fiscal,
        codigoPais: config.codigo_pais,
      },
      identificador: resumen.identificador,
      fechaReferencia: resumen.fecha_referencia,
      fechaGeneracion: resumen.fecha_generacion,
      lineas: detalles.map((d) => {
        const c = d.comprobantes_electronicos;
        return {
          tipoComprobante: c.tipo_comprobante,
          serie: c.serie,
          correlativo: c.correlativo,
          clienteTipoDocumento: c.cliente_tipo_documento ?? '0',
          clienteNumeroDocumento: c.cliente_numero_documento ?? '0',
          moneda: c.moneda,
          total: Number(c.total),
          totalGravado: Number(c.total_gravado),
          totalExonerado: Number(c.total_exonerado),
          totalInafecto: Number(c.total_inafecto),
          totalIgv: Number(c.total_igv),
          condicion: d.condicion,
        };
      }),
    });

    const dir = `empresas/${config.ruc}/resumenes/${resumen.identificador}`;
    const xmlPath = await this.storage.guardar(
      `${dir}/original.xml`,
      Buffer.from(xml, 'utf8'),
    );

    const certBuffer = await this.storage.leer(config.certificado_path ?? '');
    const cert = this.firma.extraerCertificado(
      certBuffer,
      this.encryption.decrypt(config.certificado_clave_encriptada ?? ''),
    );
    const firmado = this.firma.firmarXml(
      xml,
      cert.privateKeyPem,
      cert.certBase64,
    );
    await this.storage.guardar(
      `${dir}/firmado.xml`,
      Buffer.from(firmado.xmlFirmado, 'utf8'),
    );

    const nombreZip = `${config.ruc}-${resumen.identificador}.zip`;
    const zipBuffer = this.zip.comprimirXml(
      `${config.ruc}-${resumen.identificador}`,
      firmado.xmlFirmado,
    );
    const zipPath = await this.storage.guardar(`${dir}/resumen.zip`, zipBuffer);

    const credenciales: CredencialesSol = {
      ruc: config.ruc,
      usuario: this.encryption.decrypt(config.sol_usuario_encriptado ?? ''),
      clave: this.encryption.decrypt(config.sol_clave_encriptada ?? ''),
    };
    const envio = await this.soap.sendSummary(
      config.ambiente,
      credenciales,
      nombreZip,
      zipBuffer,
    );

    if (!envio.exito || !envio.ticket) {
      await this.prisma.resumenes_diarios.update({
        where: { id: resumen.id },
        data: {
          estado: 'ERROR_ENVIO',
          codigo_respuesta: envio.codigoError,
          mensaje_respuesta: envio.mensajeError,
          xml_path: xmlPath,
          zip_path: zipPath,
          enviado_at: new Date(),
          updated_at: new Date(),
        },
      });
      throw new BadRequestException(
        `SUNAT no aceptó el resumen: ${envio.mensajeError ?? envio.codigoError}`,
      );
    }

    return this.prisma.resumenes_diarios.update({
      where: { id: resumen.id },
      data: {
        estado: 'ENVIADO',
        ticket_sunat: envio.ticket,
        xml_path: xmlPath,
        zip_path: zipPath,
        enviado_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  /** Consulta el ticket en SUNAT (getStatus) y procesa la CDR si está lista. */
  async consultar(resumenId: string, boticaId: string) {
    const resumen = await this.obtener(resumenId, boticaId);
    if (!resumen.ticket_sunat) {
      throw new BadRequestException('El resumen aún no fue enviado a SUNAT');
    }
    if (resumen.estado === 'PROCESADO') {
      return resumen;
    }

    const config = await this.obtenerConfiguracion(boticaId);
    const credenciales: CredencialesSol = {
      ruc: config.ruc,
      usuario: this.encryption.decrypt(config.sol_usuario_encriptado ?? ''),
      clave: this.encryption.decrypt(config.sol_clave_encriptada ?? ''),
    };
    const estado = await this.soap.getStatus(
      config.ambiente,
      credenciales,
      resumen.ticket_sunat,
    );

    if (!estado.exito) {
      throw new BadRequestException(
        `No se pudo consultar el ticket: ${estado.mensajeError}`,
      );
    }
    // Código 98 = en procesamiento; 0/otros con CDR = procesado
    if (estado.codigoRespuesta === '98' || !estado.cdrZipBase64) {
      return this.prisma.resumenes_diarios.update({
        where: { id: resumen.id },
        data: {
          estado: 'EN_PROCESO',
          codigo_respuesta: estado.codigoRespuesta,
          updated_at: new Date(),
        },
      });
    }

    const cdrZip = Buffer.from(estado.cdrZipBase64, 'base64');
    const cdr = this.cdrParser.parsear(cdrZip);
    const dir = `empresas/${config.ruc}/resumenes/${resumen.identificador}`;
    const cdrZipPath = await this.storage.guardar(`${dir}/cdr.zip`, cdrZip);
    const cdrXmlPath = await this.storage.guardar(
      `${dir}/cdr.xml`,
      Buffer.from(cdr.cdrXml, 'utf8'),
    );

    const aceptado =
      cdr.estado === EstadoComprobante.ACEPTADO ||
      cdr.estado === EstadoComprobante.ACEPTADO_CON_OBSERVACIONES;

    // Actualiza las boletas del resumen
    const detalles = await this.prisma.resumenes_diarios_detalles.findMany({
      where: { resumen_id: resumen.id },
    });
    await this.prisma.$transaction([
      this.prisma.resumenes_diarios_detalles.updateMany({
        where: { resumen_id: resumen.id },
        data: {
          estado_resultado: aceptado ? 'ACEPTADO' : 'RECHAZADO',
          mensaje_resultado: cdr.descripcion,
        },
      }),
      this.prisma.comprobantes_electronicos.updateMany({
        where: { id: { in: detalles.map((d) => d.comprobante_id) } },
        data: {
          estado: aceptado
            ? EstadoComprobante.ACEPTADO
            : EstadoComprobante.RECHAZADO,
          codigo_respuesta: cdr.codigoRespuesta,
          mensaje_respuesta: cdr.descripcion,
          ...(aceptado
            ? { aceptado_at: new Date() }
            : { rechazado_at: new Date() }),
          updated_at: new Date(),
        },
      }),
    ]);

    await this.audit.registrar({
      accion: 'RESUMEN_DIARIO_PROCESADO',
      tabla: 'resumenes_diarios',
      registros_afectados: 1,
      botica_id: boticaId,
      observacion:
        `${resumen.identificador}: ${cdr.codigoRespuesta} ${cdr.descripcion}`.slice(
          0,
          500,
        ),
    });

    return this.prisma.resumenes_diarios.update({
      where: { id: resumen.id },
      data: {
        estado: aceptado ? 'PROCESADO' : 'RECHAZADO',
        codigo_respuesta: cdr.codigoRespuesta,
        mensaje_respuesta: cdr.descripcion,
        observaciones: cdr.observaciones,
        cdr_zip_path: cdrZipPath,
        cdr_xml_path: cdrXmlPath,
        procesado_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  async listar(boticaId: string) {
    return this.prisma.resumenes_diarios.findMany({
      where: { botica_id: boticaId },
      orderBy: { fecha_generacion: 'desc' },
      take: 100,
      include: { detalles: { select: { comprobante_id: true } } },
    });
  }

  private async obtener(resumenId: string, boticaId: string) {
    const resumen = await this.prisma.resumenes_diarios.findFirst({
      where: { id: resumenId, botica_id: boticaId },
    });
    if (!resumen) throw new NotFoundException('Resumen no encontrado');
    return resumen;
  }

  private async obtenerConfiguracion(boticaId: string) {
    const config = await this.prisma.configuraciones_tributarias.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });
    if (!config) {
      throw new NotFoundException(
        'La empresa no tiene configuración tributaria',
      );
    }
    if (!config.sol_usuario_encriptado || !config.certificado_path) {
      throw new BadRequestException(
        'La configuración tributaria está incompleta (credenciales SOL y certificado)',
      );
    }
    return config;
  }
}
