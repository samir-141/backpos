import { Injectable, Logger, Optional } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageService } from '../../storage/storage.service';

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
 * Local: storage/empresas/{ruc}/{año}/{mes}/{tipo}-{serie}-{correlativo}/...
 * Supabase Storage: boticas-private/empresas/{ruc}/...
 */
@Injectable()
export class ComprobanteStorageService {
  private readonly logger = new Logger(ComprobanteStorageService.name);

  constructor(
    private readonly storage: LocalFileStorageProvider,
    @Optional() private readonly supabaseStorage?: StorageService,
  ) {}

  directorioComprobante(
    ruc: string,
    fechaEmision: Date,
    nombreArchivo: string,
  ): string {
    const anio = fechaEmision.getFullYear();
    const mes = String(fechaEmision.getMonth() + 1).padStart(2, '0');
    return path.posix.join('empresas', ruc, String(anio), mes, nombreArchivo);
  }

  async guardarXml(dir: string, xml: string): Promise<string> {
    const relPath = path.posix.join(dir, 'original.xml');
    const buffer = Buffer.from(xml, 'utf8');
    const local = await this.storage.save(relPath, buffer);
    if (this.supabaseStorage) {
      this.supabaseStorage
        .subirRutaDirecta('boticas-private', relPath, buffer, 'application/xml')
        .catch((e) =>
          this.logger.warn(`Supabase XML sync aviso: ${e.message}`),
        );
    }
    return local;
  }

  async guardarXmlFirmado(dir: string, xml: string): Promise<string> {
    const relPath = path.posix.join(dir, 'firmado.xml');
    const buffer = Buffer.from(xml, 'utf8');
    const local = await this.storage.save(relPath, buffer);
    if (this.supabaseStorage) {
      this.supabaseStorage
        .subirRutaDirecta('boticas-private', relPath, buffer, 'application/xml')
        .catch((e) =>
          this.logger.warn(`Supabase Signed XML sync aviso: ${e.message}`),
        );
    }
    return local;
  }

  async guardarZip(dir: string, zip: Buffer): Promise<string> {
    const relPath = path.posix.join(dir, 'comprobante.zip');
    const local = await this.storage.save(relPath, zip);
    if (this.supabaseStorage) {
      this.supabaseStorage
        .subirRutaDirecta('boticas-private', relPath, zip, 'application/zip')
        .catch((e) =>
          this.logger.warn(`Supabase ZIP sync aviso: ${e.message}`),
        );
    }
    return local;
  }

  async guardarCdrZip(dir: string, zip: Buffer): Promise<string> {
    const relPath = path.posix.join(dir, 'cdr.zip');
    const local = await this.storage.save(relPath, zip);
    if (this.supabaseStorage) {
      this.supabaseStorage
        .subirRutaDirecta('boticas-private', relPath, zip, 'application/zip')
        .catch((e) =>
          this.logger.warn(`Supabase CDR sync aviso: ${e.message}`),
        );
    }
    return local;
  }

  async guardarCdrXml(dir: string, xml: string): Promise<string> {
    const relPath = path.posix.join(dir, 'cdr.xml');
    const buffer = Buffer.from(xml, 'utf8');
    const local = await this.storage.save(relPath, buffer);
    if (this.supabaseStorage) {
      this.supabaseStorage
        .subirRutaDirecta('boticas-private', relPath, buffer, 'application/xml')
        .catch((e) =>
          this.logger.warn(`Supabase CDR XML sync aviso: ${e.message}`),
        );
    }
    return local;
  }

  async guardarPdf(dir: string, pdf: Buffer): Promise<string> {
    const relPath = path.posix.join(dir, 'comprobante.pdf');
    const local = await this.storage.save(relPath, pdf);
    if (this.supabaseStorage) {
      this.supabaseStorage
        .subirRutaDirecta('boticas-public', relPath, pdf, 'application/pdf')
        .catch((e) =>
          this.logger.warn(`Supabase PDF sync aviso: ${e.message}`),
        );
    }
    return local;
  }

  async leer(relativePath: string): Promise<Buffer> {
    try {
      return await this.storage.read(relativePath);
    } catch (localErr) {
      if (this.supabaseStorage) {
        // Intentar descargar desde Supabase Storage
        const remoteBuffer =
          (await this.supabaseStorage.descargarRutaDirecta(
            'boticas-private',
            relativePath,
          )) ||
          (await this.supabaseStorage.descargarRutaDirecta(
            'boticas-public',
            relativePath,
          ));
        if (remoteBuffer) {
          await this.storage.save(relativePath, remoteBuffer).catch(() => {});
          return remoteBuffer;
        }
      }
      throw localErr;
    }
  }

  /** Guardado genérico (p.ej. certificado digital). */
  async guardar(relativePath: string, contenido: Buffer): Promise<string> {
    const local = await this.storage.save(relativePath, contenido);
    if (this.supabaseStorage) {
      this.supabaseStorage
        .subirRutaDirecta('boticas-private', relativePath, contenido)
        .catch((e) =>
          this.logger.warn(`Supabase generic sync aviso: ${e.message}`),
        );
    }
    return local;
  }

  async existe(relativePath: string): Promise<boolean> {
    const existsLocal = await this.storage.exists(relativePath);
    if (existsLocal) return true;
    return false;
  }
}
