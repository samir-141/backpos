import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

/** Contrato de almacenamiento de artefactos tributarios. */
export interface FileStorageProvider {
  save(relativePath: string, contenido: Buffer): Promise<string>;
  read(relativePath: string): Promise<Buffer>;
  exists(relativePath: string): Promise<boolean>;
}

/**
 * Almacenamiento local en disco. La ruta raíz se configura con
 * COMPROBANTES_STORAGE_DIR (por defecto ./storage). Los archivos
 * tributarios no se eliminan automáticamente.
 */
@Injectable()
export class LocalFileStorageProvider implements FileStorageProvider {
  private readonly logger = new Logger(LocalFileStorageProvider.name);
  private readonly root: string;

  constructor() {
    this.root = path.resolve(
      process.cwd(),
      process.env.COMPROBANTES_STORAGE_DIR ?? 'storage',
    );
  }

  async save(relativePath: string, contenido: Buffer): Promise<string> {
    const destino = this.resolver(relativePath);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, contenido);
    return relativePath;
  }

  async read(relativePath: string): Promise<Buffer> {
    return fs.readFile(this.resolver(relativePath));
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolver(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  /** Evita path traversal fuera del directorio raíz. */
  private resolver(relativePath: string): string {
    const destino = path.resolve(this.root, relativePath);
    if (!destino.startsWith(this.root)) {
      this.logger.error(`Ruta de almacenamiento inválida: ${relativePath}`);
      throw new Error('Ruta de almacenamiento inválida');
    }
    return destino;
  }
}

/**
 * Rutas y persistencia de artefactos de un comprobante:
 * storage/empresas/{ruc}/{año}/{mes}/{tipo}-{serie}-{correlativo}/...
 */
@Injectable()
export class ComprobanteStorageService {
  constructor(private readonly storage: LocalFileStorageProvider) {}

  directorioComprobante(
    ruc: string,
    fechaEmision: Date,
    nombreArchivo: string,
  ): string {
    const anio = fechaEmision.getFullYear();
    const mes = String(fechaEmision.getMonth() + 1).padStart(2, '0');
    return path.posix.join('empresas', ruc, String(anio), mes, nombreArchivo);
  }

  guardarXml(dir: string, xml: string): Promise<string> {
    return this.storage.save(
      path.posix.join(dir, 'original.xml'),
      Buffer.from(xml, 'utf8'),
    );
  }

  guardarXmlFirmado(dir: string, xml: string): Promise<string> {
    return this.storage.save(
      path.posix.join(dir, 'firmado.xml'),
      Buffer.from(xml, 'utf8'),
    );
  }

  guardarZip(dir: string, zip: Buffer): Promise<string> {
    return this.storage.save(path.posix.join(dir, 'comprobante.zip'), zip);
  }

  guardarCdrZip(dir: string, zip: Buffer): Promise<string> {
    return this.storage.save(path.posix.join(dir, 'cdr.zip'), zip);
  }

  guardarCdrXml(dir: string, xml: string): Promise<string> {
    return this.storage.save(
      path.posix.join(dir, 'cdr.xml'),
      Buffer.from(xml, 'utf8'),
    );
  }

  guardarPdf(dir: string, pdf: Buffer): Promise<string> {
    return this.storage.save(path.posix.join(dir, 'comprobante.pdf'), pdf);
  }

  leer(relativePath: string): Promise<Buffer> {
    return this.storage.read(relativePath);
  }

  /** Guardado genérico (p.ej. certificado digital). */
  guardar(relativePath: string, contenido: Buffer): Promise<string> {
    return this.storage.save(relativePath, contenido);
  }

  existe(relativePath: string): Promise<boolean> {
    return this.storage.exists(relativePath);
  }
}
