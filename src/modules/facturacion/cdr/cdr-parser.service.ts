import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { ZipService } from '../zip/zip.service';
import { EstadoComprobante } from '../domain/estado-comprobante.enum';

export interface ResultadoCdr {
  codigoRespuesta: string;
  descripcion: string;
  observaciones: string[];
  estado: EstadoComprobante;
  /** XML de la CDR descomprimido (para almacenar). */
  cdrXml: string;
  /** Nombre del archivo dentro del ZIP de la CDR. */
  nombreArchivoCdr: string;
}

/**
 * Procesa la Constancia de Recepción (CDR) de SUNAT.
 * Un HTTP 200 NO implica aceptación: el estado se decide por
 * cbc:ResponseCode dentro del XML de la CDR.
 */
@Injectable()
export class CdrParserService {
  constructor(private readonly zip: ZipService) {}

  parsear(cdrZip: Buffer): ResultadoCdr {
    let nombre: string;
    let contenido: Buffer;
    try {
      const extraido = this.zip.extraerPrimero(cdrZip);
      nombre = extraido.nombre;
      contenido = extraido.contenido;
    } catch {
      throw new BadRequestException('La CDR recibida no es un ZIP válido');
    }

    const cdrXml = contenido.toString('utf8');
    if (!cdrXml.trim()) {
      throw new BadRequestException('La CDR contiene un XML vacío');
    }

    const parser = new XMLParser({
      removeNSPrefix: true,
      ignoreAttributes: false,
    });
    let doc: Record<string, any>;
    try {
      doc = parser.parse(cdrXml) as Record<string, any>;
    } catch {
      throw new BadRequestException('El XML de la CDR no es parseable');
    }

    const respuesta = doc?.['ApplicationResponse'] as
      Record<string, any> | undefined;
    const documentResponse = respuesta?.['DocumentResponse'] as
      Record<string, any> | undefined;
    const response = documentResponse?.['Response'] as
      Record<string, any> | undefined;
    if (!response) {
      throw new BadRequestException(
        'La CDR no contiene DocumentResponse/Response',
      );
    }

    const codigo = String(response['ResponseCode'] ?? '');
    if (!codigo) {
      throw new BadRequestException('La CDR no contiene ResponseCode');
    }
    const descripcion = String(response['Description'] ?? '');
    const notas: unknown = response['Note'];
    const textoNota = (n: unknown): string =>
      typeof n === 'string' || typeof n === 'number' ? String(n) : '';
    const observaciones: string[] = (
      Array.isArray(notas)
        ? notas.map(textoNota)
        : notas !== undefined && notas !== null
          ? [textoNota(notas)]
          : []
    ).filter((n) => n.length > 0);

    return {
      codigoRespuesta: codigo,
      descripcion,
      observaciones,
      estado: this.estadoPorCodigo(codigo),
      cdrXml,
      nombreArchivoCdr: nombre,
    };
  }

  /**
   * Clasificación oficial SUNAT del código de respuesta:
   * 0            → aceptado.
   * 0100 - 1999  → aceptado con observaciones / excepciones.
   * 2000 en adelante → rechazado.
   */
  estadoPorCodigo(codigo: string): EstadoComprobante {
    if (codigo === '0') return EstadoComprobante.ACEPTADO;
    const numero = Number(codigo);
    if (!Number.isNaN(numero) && numero >= 100 && numero < 2000) {
      return EstadoComprobante.ACEPTADO_CON_OBSERVACIONES;
    }
    return EstadoComprobante.RECHAZADO;
  }
}
