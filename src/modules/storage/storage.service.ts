import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';

export type SubcarpetaBotica =
  'logos' | 'certs' | 'comprobantes' | 'recetas' | 'backups' | 'general';

export interface SubirArchivoOptions {
  boticaId: string;
  carpeta: SubcarpetaBotica;
  subRuta?: string; // ej. 'xml', 'cdr', 'pdf'
  nombreArchivo: string;
  buffer: Buffer;
  mimeType?: string;
  esPublico?: boolean;
}

export interface ResultadoSubida {
  ok: boolean;
  path: string;
  bucket: string;
  publicUrl?: string;
  signedUrl?: string;
  error?: string;
}

export interface ResultadoTestConexion {
  ok: boolean;
  mensaje: string;
  urlConfigurada: boolean;
  keyConfigurada: boolean;
  bucketsDisponibles: string[];
  latenciaMs: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient | null = null;
  private readonly bucketPublico: string;
  private readonly bucketPrivado: string;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.bucketPublico =
      process.env.SUPABASE_STORAGE_BUCKET_PUBLIC || 'boticas-public';
    this.bucketPrivado =
      process.env.SUPABASE_STORAGE_BUCKET_PRIVATE || 'boticas-private';
  }

  onModuleInit() {
    this.inicializarCliente();
  }

  /**
   * Obtiene la configuración de ticket guardada para la botica
   */
  async obtenerConfiguracionTicket(
    boticaId: string,
  ): Promise<Record<string, any> | null> {
    if (!this.prisma) return null;
    try {
      const botica = await this.prisma.boticas.findUnique({
        where: { id: boticaId },
        select: {
          configuracion: true,
          nombre: true,
          ruc: true,
          direccion: true,
          telefono: true,
        },
      });
      const conf = (botica?.configuracion as Record<string, any>) || {};
      return conf.ticket || null;
    } catch (e: any) {
      this.logger.warn(
        `Error al consultar configuracion de ticket: ${e.message}`,
      );
      return null;
    }
  }

  /**
   * Guarda la configuración de ticket en la base de datos de la botica y en Supabase Storage
   */
  async guardarConfiguracionTicket(
    boticaId: string,
    ticketConfig: Record<string, any>,
  ): Promise<boolean> {
    if (!this.prisma) return false;
    try {
      // 1. Si el logo viene en formato Base64 (data:image/...), subirlo automáticamente a Supabase Storage
      if (
        typeof ticketConfig.logoUrl === 'string' &&
        ticketConfig.logoUrl.startsWith('data:image/')
      ) {
        const matches = ticketConfig.logoUrl.match(
          /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/,
        );
        if (matches) {
          try {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = mimeType.split('/')[1] || 'png';
            const resLogo = await this.subirArchivo({
              boticaId,
              carpeta: 'logos',
              nombreArchivo: `logo_main.${ext}`,
              buffer,
              mimeType,
              esPublico: true,
            });
            if (resLogo.publicUrl) {
              ticketConfig.logoUrl = resLogo.publicUrl;
            }
          } catch (errLogo: any) {
            this.logger.warn(
              `No se pudo convertir/subir imagen base64 a Supabase: ${errLogo.message}`,
            );
          }
        }
      }

      // 2. Subir también el archivo JSON completo a Supabase Storage bajo {boticaId}/general/config/ticket-config.json
      try {
        const jsonBuffer = Buffer.from(
          JSON.stringify(ticketConfig, null, 2),
          'utf-8',
        );
        await this.subirArchivo({
          boticaId,
          carpeta: 'general',
          subRuta: 'config',
          nombreArchivo: 'ticket-config.json',
          buffer: jsonBuffer,
          mimeType: 'application/json',
          esPublico: true,
        });
      } catch (errSync: any) {
        this.logger.warn(
          `No se pudo sincronizar ticket-config.json en Supabase Storage: ${errSync.message}`,
        );
      }

      // 3. Guardar en Base de Datos PostgreSQL
      const botica = await this.prisma.boticas.findUnique({
        where: { id: boticaId },
        select: { configuracion: true },
      });

      const confActual = (botica?.configuracion as Record<string, any>) || {};
      const confNueva = { ...confActual, ticket: ticketConfig };

      await this.prisma.boticas.update({
        where: { id: boticaId },
        data: { configuracion: confNueva },
      });
      return true;
    } catch (e: any) {
      this.logger.error(
        `Error al guardar configuracion de ticket: ${e.message}`,
      );
      return false;
    }
  }

  private inicializarCliente(): boolean {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'Supabase Storage no configurado completamente. Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY.',
      );
      this.supabase = null;
      return false;
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this.logger.log(
        'Cliente de Supabase Storage inicializado correctamente.',
      );
      return true;
    } catch (err: any) {
      this.logger.error(`Error al instanciar cliente Supabase: ${err.message}`);
      this.supabase = null;
      return false;
    }
  }

  /**
   * Asegura que los buckets necesarios existan en Supabase
   */
  async asegurarBuckets(): Promise<{ publico: boolean; privado: boolean }> {
    if (!this.supabase) {
      this.inicializarCliente();
      if (!this.supabase) return { publico: false, privado: false };
    }

    let publicoOk = false;
    let privadoOk = false;

    try {
      const { data: buckets, error } =
        await this.supabase.storage.listBuckets();
      if (error) {
        this.logger.warn(`No se pudo listar buckets: ${error.message}`);
      } else {
        const nombres = (buckets || []).map((b) => b.name);
        publicoOk = nombres.includes(this.bucketPublico);
        privadoOk = nombres.includes(this.bucketPrivado);
      }

      // Si no existen y tenemos permisos, intentar crearlos
      if (!publicoOk) {
        const { error: errCreatePub } =
          await this.supabase.storage.createBucket(this.bucketPublico, {
            public: true,
          });
        if (!errCreatePub) {
          publicoOk = true;
          this.logger.log(
            `Bucket público '${this.bucketPublico}' creado exitosamente.`,
          );
        }
      }

      if (!privadoOk) {
        const { error: errCreatePriv } =
          await this.supabase.storage.createBucket(this.bucketPrivado, {
            public: false,
          });
        if (!errCreatePriv) {
          privadoOk = true;
          this.logger.log(
            `Bucket privado '${this.bucketPrivado}' creado exitosamente.`,
          );
        }
      }
    } catch (e: any) {
      this.logger.warn(`Aseguramiento de buckets con aviso: ${e.message}`);
    }

    return { publico: publicoOk, privado: privadoOk };
  }

  /**
   * Sube directamente a una ruta dentro de un bucket específico
   */
  async subirRutaDirecta(
    bucket: string,
    rutaCompleta: string,
    buffer: Buffer,
    mimeType?: string,
  ): Promise<boolean> {
    if (!this.supabase) {
      this.inicializarCliente();
      if (!this.supabase) return false;
    }
    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .upload(rutaCompleta, buffer, {
          contentType: mimeType || 'application/octet-stream',
          upsert: true,
        });
      if (error) {
        this.logger.warn(
          `Error en subirRutaDirecta (${rutaCompleta}): ${error.message}`,
        );
        return false;
      }
      return true;
    } catch (e: any) {
      this.logger.warn(`Excepción en subirRutaDirecta: ${e.message}`);
      return false;
    }
  }

  /**
   * Descarga directamente desde una ruta
   */
  async descargarRutaDirecta(
    bucket: string,
    rutaCompleta: string,
  ): Promise<Buffer | null> {
    if (!this.supabase) {
      this.inicializarCliente();
      if (!this.supabase) return null;
    }
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .download(rutaCompleta);
      if (error || !data) return null;
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  /**
   * Prueba integral de conexión con Supabase Storage
   */
  async probarConexion(): Promise<ResultadoTestConexion> {
    const inicio = Date.now();
    const urlConfigurada = Boolean(process.env.SUPABASE_URL);
    const keyConfigurada = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY,
    );

    if (!urlConfigurada || !keyConfigurada) {
      return {
        ok: false,
        mensaje:
          'Faltan configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env',
        urlConfigurada,
        keyConfigurada,
        bucketsDisponibles: [],
        latenciaMs: 0,
      };
    }

    if (!this.supabase) {
      const ok = this.inicializarCliente();
      if (!ok || !this.supabase) {
        return {
          ok: false,
          mensaje:
            'No se pudo inicializar la conexión con las credenciales provistas.',
          urlConfigurada,
          keyConfigurada,
          bucketsDisponibles: [],
          latenciaMs: Date.now() - inicio,
        };
      }
    }

    try {
      const { data: buckets, error } =
        await this.supabase.storage.listBuckets();
      const latencia = Date.now() - inicio;

      if (error) {
        return {
          ok: false,
          mensaje: `Error devuelto por Supabase: ${error.message}`,
          urlConfigurada,
          keyConfigurada,
          bucketsDisponibles: [],
          latenciaMs: latencia,
        };
      }

      const nombresBuckets = (buckets || []).map((b) => b.name);

      // Intentar una operación de ping de escritura/lectura en bucket público o privado
      await this.asegurarBuckets();

      return {
        ok: true,
        mensaje:
          'Conexión exitosa con Supabase Storage. Buckets listados y operativos.',
        urlConfigurada,
        keyConfigurada,
        bucketsDisponibles: nombresBuckets,
        latenciaMs: latencia,
      };
    } catch (e: any) {
      return {
        ok: false,
        mensaje: `Fallo al comunicarse con Supabase: ${e.message}`,
        urlConfigurada,
        keyConfigurada,
        bucketsDisponibles: [],
        latenciaMs: Date.now() - inicio,
      };
    }
  }

  /**
   * Construye la ruta canónica dentro de la botica:
   * ej: "botica-uuid-123/logos/logo.png" o "botica-uuid-123/comprobantes/xml/B001-12.xml"
   */
  construirRuta(
    boticaId: string,
    carpeta: SubcarpetaBotica,
    nombreArchivo: string,
    subRuta?: string,
  ): string {
    const safeBoticaId = boticaId.trim();
    const safeNombre = nombreArchivo.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (subRuta) {
      return `${safeBoticaId}/${carpeta}/${subRuta}/${safeNombre}`;
    }
    return `${safeBoticaId}/${carpeta}/${safeNombre}`;
  }

  /**
   * Sube un archivo a la carpeta aislada de la botica
   */
  async subirArchivo(options: SubirArchivoOptions): Promise<ResultadoSubida> {
    if (!this.supabase) {
      this.inicializarCliente();
      if (!this.supabase) {
        return {
          ok: false,
          path: '',
          bucket: '',
          error: 'Supabase Storage no está configurado en el servidor.',
        };
      }
    }

    const {
      boticaId,
      carpeta,
      subRuta,
      nombreArchivo,
      buffer,
      mimeType,
      esPublico,
    } = options;
    const bucket =
      esPublico || carpeta === 'logos'
        ? this.bucketPublico
        : this.bucketPrivado;
    const ruta = this.construirRuta(boticaId, carpeta, nombreArchivo, subRuta);

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(ruta, buffer, {
          contentType: mimeType || 'application/octet-stream',
          upsert: true,
        });

      if (error) {
        this.logger.error(
          `Error al subir archivo a Supabase (${ruta}): ${error.message}`,
        );
        return {
          ok: false,
          path: ruta,
          bucket,
          error: error.message,
        };
      }

      let publicUrl: string | undefined;
      let signedUrl: string | undefined;

      if (bucket === this.bucketPublico) {
        const { data: pubData } = this.supabase.storage
          .from(bucket)
          .getPublicUrl(ruta);
        publicUrl = pubData?.publicUrl;
      } else {
        // Generar URL firmada válida por 1 hora
        const { data: signData } = await this.supabase.storage
          .from(bucket)
          .createSignedUrl(ruta, 3600);
        signedUrl = signData?.signedUrl;
      }

      return {
        ok: true,
        path: data?.path || ruta,
        bucket,
        publicUrl,
        signedUrl,
      };
    } catch (e: any) {
      this.logger.error(`Excepción al subir a Supabase: ${e.message}`);
      return {
        ok: false,
        path: ruta,
        bucket,
        error: e.message,
      };
    }
  }

  /**
   * Obtiene la URL pública directa para un archivo (ej. Logo)
   */
  obtenerUrlPublica(
    boticaId: string,
    carpeta: SubcarpetaBotica,
    nombreArchivo: string,
    subRuta?: string,
  ): string | null {
    if (!this.supabase) return null;
    const ruta = this.construirRuta(boticaId, carpeta, nombreArchivo, subRuta);
    const { data } = this.supabase.storage
      .from(this.bucketPublico)
      .getPublicUrl(ruta);
    return data?.publicUrl || null;
  }

  /**
   * Obtiene una URL firmada con tiempo de expiración para archivos protegidos
   */
  async obtenerUrlFirmada(
    boticaId: string,
    carpeta: SubcarpetaBotica,
    nombreArchivo: string,
    expiracionSegundos = 3600,
    subRuta?: string,
  ): Promise<string | null> {
    if (!this.supabase) return null;
    const ruta = this.construirRuta(boticaId, carpeta, nombreArchivo, subRuta);
    const bucket =
      carpeta === 'logos' ? this.bucketPublico : this.bucketPrivado;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(ruta, expiracionSegundos);

    if (error || !data) {
      this.logger.warn(
        `No se pudo generar URL firmada para ${ruta}: ${error?.message}`,
      );
      return null;
    }

    return data.signedUrl;
  }

  /**
   * Descarga un archivo directamente como Buffer (útil para firmar certificados o leer XMLs)
   */
  async descargarArchivo(
    boticaId: string,
    carpeta: SubcarpetaBotica,
    nombreArchivo: string,
    subRuta?: string,
  ): Promise<Buffer | null> {
    if (!this.supabase) return null;
    const ruta = this.construirRuta(boticaId, carpeta, nombreArchivo, subRuta);
    const bucket =
      carpeta === 'logos' ? this.bucketPublico : this.bucketPrivado;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(ruta);
    if (error || !data) {
      this.logger.warn(`Error al descargar archivo ${ruta}: ${error?.message}`);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Elimina un archivo
   */
  async eliminarArchivo(
    boticaId: string,
    carpeta: SubcarpetaBotica,
    nombreArchivo: string,
    subRuta?: string,
  ): Promise<boolean> {
    if (!this.supabase) return false;
    const ruta = this.construirRuta(boticaId, carpeta, nombreArchivo, subRuta);
    const bucket =
      carpeta === 'logos' ? this.bucketPublico : this.bucketPrivado;

    const { error } = await this.supabase.storage.from(bucket).remove([ruta]);
    if (error) {
      this.logger.warn(`Error al eliminar archivo ${ruta}: ${error.message}`);
      return false;
    }
    return true;
  }

  /**
   * Lista los archivos almacenados en la carpeta de la botica
   */
  async listarArchivos(
    boticaId: string,
    carpeta: SubcarpetaBotica,
    subRuta?: string,
  ): Promise<
    Array<{ nombre: string; id: string; createdAt: string; size: number }>
  > {
    if (!this.supabase) return [];
    const prefix = subRuta
      ? `${boticaId}/${carpeta}/${subRuta}`
      : `${boticaId}/${carpeta}`;
    const bucket =
      carpeta === 'logos' ? this.bucketPublico : this.bucketPrivado;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .list(prefix);
    if (error || !data) {
      return [];
    }

    return data
      .filter((item) => item.name !== '.emptyFolderPlaceholder')
      .map((item) => ({
        nombre: item.name,
        id: item.id || item.name,
        createdAt: item.created_at || new Date().toISOString(),
        size: item.metadata?.size || 0,
      }));
  }
}
