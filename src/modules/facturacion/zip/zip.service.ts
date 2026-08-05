import { Injectable, BadRequestException } from '@nestjs/common';
import AdmZip from 'adm-zip';

/**
 * Compresión ZIP según formato SUNAT: el ZIP contiene directamente
 * un único archivo XML con el mismo nombre base que el ZIP.
 *   20123456789-03-B001-1.zip → 20123456789-03-B001-1.xml
 */
@Injectable()
export class ZipService {
  comprimirXml(nombreArchivo: string, xml: string | Buffer): Buffer {
    const zip = new AdmZip();
    const contenido = typeof xml === 'string' ? Buffer.from(xml, 'utf8') : xml;
    zip.addFile(`${nombreArchivo}.xml`, contenido);
    return zip.toBuffer();
  }

  /** Extrae el primer archivo de un ZIP (p.ej. el XML de una CDR). */
  extraerPrimero(zipBuffer: Buffer): { nombre: string; contenido: Buffer } {
    try {
      const zip = new AdmZip(zipBuffer);
      const entrada = zip.getEntries().find((e) => !e.isDirectory);
      if (!entrada) {
        throw new BadRequestException('El ZIP no contiene archivos');
      }
      return {
        nombre: entrada.entryName,
        contenido: entrada.getData(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'El archivo ZIP está corrupto o es inválido',
      );
    }
  }
}
