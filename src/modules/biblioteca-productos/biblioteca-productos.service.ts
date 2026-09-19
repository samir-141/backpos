import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScraperProductosService } from './services/scraper-productos.service';
import { CreateCatalogoMaestroDto } from './dto/create-catalogo-maestro.dto';
import { QueryBibliotecaDto } from './dto/query-biblioteca.dto';

@Injectable()
export class BibliotecaProductosService implements OnModuleInit {
  private readonly logger = new Logger(BibliotecaProductosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraperService: ScraperProductosService,
  ) {}

  async onModuleInit() {
    await this.asegurarTablaEIndices();
    await this.seedDatosIniciales();
    await this.normalizarMayusculasBaseDeDatos();
  }

  /**
   * Crea la tabla global catalogo_maestro_productos si no existe
   */
  private async asegurarTablaEIndices() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.catalogo_maestro_productos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          codigo_barras VARCHAR(50) UNIQUE NOT NULL,
          sku VARCHAR(50),
          nombre_comercial VARCHAR(150) NOT NULL,
          tipo_producto VARCHAR(30) DEFAULT 'MEDICAMENTO' NOT NULL,
          principio_activo VARCHAR(150),
          concentracion VARCHAR(50),
          unidad_concentracion VARCHAR(20) DEFAULT 'MG',
          forma_farmaceutica VARCHAR(100),
          via_administracion VARCHAR(50) DEFAULT 'ORAL',
          requiere_receta BOOLEAN DEFAULT false NOT NULL,
          afecto_igv BOOLEAN DEFAULT true NOT NULL,
          laboratorio VARCHAR(100),
          categoria VARCHAR(100),
          registro_sanitario VARCHAR(50),
          unidad_presentacion VARCHAR(50) DEFAULT 'CAJA',
          unidad_base VARCHAR(50) DEFAULT 'UNIDAD',
          cantidad_unidad_base INTEGER DEFAULT 1 NOT NULL,
          controla_lote BOOLEAN DEFAULT true NOT NULL,
          requiere_vencimiento BOOLEAN DEFAULT true NOT NULL,
          es_verificado BOOLEAN DEFAULT true NOT NULL,
          foto_url TEXT,
          atributos JSONB,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          deleted_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_catalogo_maestro_codigo_barras ON public.catalogo_maestro_productos (codigo_barras);
        CREATE INDEX IF NOT EXISTS idx_catalogo_maestro_nombre_comercial ON public.catalogo_maestro_productos (nombre_comercial);
        CREATE INDEX IF NOT EXISTS idx_catalogo_maestro_principio_activo ON public.catalogo_maestro_productos (principio_activo);
      `);
      this.logger.log('Tabla catalogo_maestro_productos verificada/creada exitosamente.');
    } catch (err: any) {
      this.logger.error(`Error asegurando tabla catalogo_maestro_productos: ${err.message}`);
    }
  }

  /**
   * Normaliza automáticamente registros existentes en la base de datos a MAYÚSCULAS
   * para brindar una presentación uniforme, clara y profesional en todo el sistema.
   */
  async normalizarMayusculasBaseDeDatos() {
    try {
      await this.prisma.$executeRawUnsafe(`
        UPDATE public.productos_comerciales 
        SET nombre_comercial = UPPER(TRIM(nombre_comercial)),
            sku = UPPER(TRIM(sku)),
            codigo_interno = UPPER(TRIM(codigo_interno)),
            registro_sanitario = UPPER(TRIM(registro_sanitario))
        WHERE deleted_at IS NULL;

        UPDATE public.laboratorios 
        SET nombre = UPPER(TRIM(nombre)),
            pais = UPPER(TRIM(pais))
        WHERE deleted_at IS NULL;

        UPDATE public.categorias 
        SET nombre = UPPER(TRIM(nombre))
        WHERE deleted_at IS NULL;

        UPDATE public.principios_activos 
        SET nombre = UPPER(TRIM(nombre))
        WHERE deleted_at IS NULL;

        UPDATE public.formas_farmaceuticas 
        SET nombre = UPPER(TRIM(nombre))
        WHERE deleted_at IS NULL;

        UPDATE public.unidades_presentacion 
        SET nombre = UPPER(TRIM(nombre)),
            abreviatura = UPPER(TRIM(abreviatura))
        WHERE deleted_at IS NULL;

        UPDATE public.medicamentos 
        SET via_administracion = UPPER(TRIM(via_administracion)),
            unidad_concentracion = UPPER(TRIM(unidad_concentracion))
        WHERE deleted_at IS NULL;

        UPDATE public.catalogo_maestro_productos 
        SET nombre_comercial = UPPER(TRIM(nombre_comercial)),
            principio_activo = UPPER(TRIM(principio_activo)),
            laboratorio = UPPER(TRIM(laboratorio)),
            categoria = UPPER(TRIM(categoria)),
            forma_farmaceutica = UPPER(TRIM(forma_farmaceutica)),
            unidad_presentacion = UPPER(TRIM(unidad_presentacion)),
            unidad_base = UPPER(TRIM(unidad_base)),
            via_administracion = UPPER(TRIM(via_administracion)),
            registro_sanitario = UPPER(TRIM(registro_sanitario))
        WHERE deleted_at IS NULL;
      `);
      this.logger.log('Normalización a MAYÚSCULAS de productos y catálogos ejecutada con éxito.');
    } catch (err: any) {
      this.logger.warn(`Advertencia al normalizar registros a mayúsculas: ${err.message}`);
    }
  }

  /**
   * Busca un producto por código de barras exacto.
   * 1. Consulta el catálogo maestro local de la biblioteca global.
   * 2. Si no existe, consulta la API externa / scraping en tiempo real.
   * 3. Si se encuentra en la API externa, lo guarda en el catálogo maestro para futuras consultas.
   */
  async buscarPorCodigoBarras(codigoBarras: string) {
    const cleanCode = codigoBarras.trim();
    if (!cleanCode) {
      throw new NotFoundException('Código de barras no proporcionado');
    }

    // 1. Búsqueda en catálogo maestro existente
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM public.catalogo_maestro_productos 
       WHERE codigo_barras = $1 AND deleted_at IS NULL 
       LIMIT 1`,
      cleanCode,
    );

    if (rows.length > 0) {
      return {
        ...rows[0],
        origen: 'BIBLIOTECA_GLOBAL',
      };
    }

    // 2. Si no existe en BD global, consultar API externa / scraping inteligente
    this.logger.log(`Producto no encontrado en catálogo maestro. Consultando API externa para: ${cleanCode}`);
    const scrapeado = await this.scraperService.buscarEnApiExterna(cleanCode);

    if (!scrapeado) {
      return null;
    }

    // 3. Guardar en catalogo_maestro_productos de forma automática para persistencia
    try {
      const inserted: any[] = await this.prisma.$queryRawUnsafe(
        `INSERT INTO public.catalogo_maestro_productos (
          codigo_barras, sku, nombre_comercial, tipo_producto,
          principio_activo, concentracion, unidad_concentracion,
          forma_farmaceutica, via_administracion, requiere_receta,
          afecto_igv, laboratorio, categoria,
          unidad_presentacion, unidad_base, cantidad_unidad_base,
          controla_lote, requiere_vencimiento, es_verificado, foto_url
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20
        )
        ON CONFLICT (codigo_barras) DO UPDATE SET
          nombre_comercial = EXCLUDED.nombre_comercial,
          updated_at = now()
        RETURNING *`,
        scrapeado.codigo_barras,
        scrapeado.sku || null,
        scrapeado.nombre_comercial,
        scrapeado.tipo_producto || 'MEDICAMENTO',
        scrapeado.principio_activo || null,
        scrapeado.concentracion || null,
        scrapeado.unidad_concentracion || 'MG',
        scrapeado.forma_farmaceutica || 'TABLETA',
        scrapeado.via_administracion || 'ORAL',
        scrapeado.requiere_receta ?? false,
        scrapeado.afecto_igv ?? true,
        scrapeado.laboratorio || null,
        scrapeado.categoria || 'FARMACIA GENERAL',
        scrapeado.unidad_presentacion || 'CAJA',
        scrapeado.unidad_base || 'UNIDAD',
        scrapeado.cantidad_unidad_base || 1,
        scrapeado.controla_lote ?? true,
        scrapeado.requiere_vencimiento ?? true,
        false, // es_verificado = false hasta revisión
        scrapeado.foto_url || null,
      );

      return {
        ...inserted[0],
        origen: 'API_EXTERNA',
      };
    } catch (saveErr: any) {
      this.logger.error(`Error guardando producto scrapeado en catálogo maestro: ${saveErr.message}`);
      return {
        ...scrapeado,
        id: 'external-temp',
        origen: 'API_EXTERNA',
      };
    }
  }

  /**
   * Lista productos de la biblioteca global con paginación y búsqueda
   */
  async findAll(query: QueryBibliotecaDto) {
    const { buscar, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    const condiciones = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    if (buscar?.trim()) {
      condiciones.push(
        `(LOWER(nombre_comercial) LIKE $${paramIndex} OR LOWER(principio_activo) LIKE $${paramIndex} OR LOWER(laboratorio) LIKE $${paramIndex} OR codigo_barras LIKE $${paramIndex})`,
      );
      params.push(`%${buscar.trim().toLowerCase()}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${condiciones.join(' AND ')}`;
    params.push(limit, offset);

    const queryData = `
      SELECT * FROM public.catalogo_maestro_productos
      ${whereClause}
      ORDER BY nombre_comercial ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const queryCount = `
      SELECT COUNT(*)::int AS total FROM public.catalogo_maestro_productos
      ${whereClause}
    `;

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(queryData, ...params),
      this.prisma.$queryRawUnsafe<{ total: number }[]>(
        queryCount,
        ...params.slice(0, -2),
      ),
    ]);

    const total = Number(countResult[0]?.total ?? 0);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Crea o actualiza un producto en el catálogo maestro
   */
  async create(dto: CreateCatalogoMaestroDto) {
    const codigoBarras = dto.codigo_barras.trim();

    const existing: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM public.catalogo_maestro_productos WHERE codigo_barras = $1 AND deleted_at IS NULL`,
      codigoBarras,
    );

    if (existing.length > 0) {
      throw new ConflictException(
        `Ya existe un producto con el código de barras ${codigoBarras} en el catálogo maestro.`,
      );
    }

    const inserted: any[] = await this.prisma.$queryRawUnsafe(
      `INSERT INTO public.catalogo_maestro_productos (
        codigo_barras, sku, nombre_comercial, tipo_producto,
        principio_activo, concentracion, unidad_concentracion,
        forma_farmaceutica, via_administracion, requiere_receta,
        afecto_igv, laboratorio, categoria, registro_sanitario,
        unidad_presentacion, unidad_base, cantidad_unidad_base,
        controla_lote, requiere_vencimiento, foto_url
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20
      ) RETURNING *`,
      codigoBarras,
      dto.sku?.trim().toUpperCase() || null,
      dto.nombre_comercial.trim().toUpperCase(),
      (dto.tipo_producto || 'MEDICAMENTO').trim().toUpperCase(),
      dto.principio_activo?.trim().toUpperCase() || null,
      dto.concentracion?.trim() || null,
      dto.unidad_concentracion?.trim().toUpperCase() || 'MG',
      dto.forma_farmaceutica?.trim().toUpperCase() || null,
      dto.via_administracion?.trim().toUpperCase() || 'ORAL',
      dto.requiere_receta ?? false,
      dto.afecto_igv ?? true,
      dto.laboratorio?.trim().toUpperCase() || null,
      dto.categoria?.trim().toUpperCase() || null,
      dto.registro_sanitario?.trim().toUpperCase() || null,
      dto.unidad_presentacion?.trim().toUpperCase() || 'CAJA',
      dto.unidad_base?.trim().toUpperCase() || 'UNIDAD',
      dto.cantidad_unidad_base || 1,
      dto.controla_lote ?? true,
      dto.requiere_vencimiento ?? true,
      dto.foto_url || null,
    );

    return inserted[0];
  }

  /**
   * Resuelve y crea automáticamente las dependencias locales en la botica
   * (laboratorios, categorias, principios_activos, formas_farmaceuticas, unidades_presentacion)
   * normalizadas en MAYÚSCULAS.
   */
  async resolverDependenciasLocales(
    boticaId: string,
    codigoBarras: string,
    usuarioId?: string,
  ) {
    const maestro = await this.buscarPorCodigoBarras(codigoBarras);
    if (!maestro) {
      throw new NotFoundException(
        `Producto con código de barras ${codigoBarras} no encontrado en la biblioteca global.`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Laboratorio
      let laboratorioId: string | null = null;
      if (maestro.laboratorio?.trim()) {
        const labNombre = maestro.laboratorio.trim().toUpperCase();
        const labExistente: any[] = await tx.$queryRawUnsafe(
          `SELECT id FROM public.laboratorios 
           WHERE botica_id = $1::uuid AND LOWER(nombre) = LOWER($2) AND deleted_at IS NULL 
           LIMIT 1`,
          boticaId,
          labNombre,
        );

        if (labExistente.length > 0) {
          laboratorioId = labExistente[0].id;
        } else {
          const nuevoLab: any[] = await tx.$queryRawUnsafe(
            `INSERT INTO public.laboratorios (botica_id, nombre, created_by, updated_by)
             VALUES ($1::uuid, $2, $3::uuid, $3::uuid) RETURNING id`,
            boticaId,
            labNombre,
            usuarioId || null,
          );
          laboratorioId = nuevoLab[0].id;
        }
      }

      // 2. Categoría
      let categoriaId: string | null = null;
      const catNombre = (maestro.categoria?.trim() || 'GENERAL').toUpperCase();
      const catExistente: any[] = await tx.$queryRawUnsafe(
        `SELECT id FROM public.categorias 
         WHERE botica_id = $1::uuid AND LOWER(nombre) = LOWER($2) AND deleted_at IS NULL 
         LIMIT 1`,
        boticaId,
        catNombre,
      );

      if (catExistente.length > 0) {
        categoriaId = catExistente[0].id;
      } else {
        const nuevaCat: any[] = await tx.$queryRawUnsafe(
          `INSERT INTO public.categorias (botica_id, nombre, created_by, updated_by)
           VALUES ($1::uuid, $2, $3::uuid, $3::uuid) RETURNING id`,
          boticaId,
          catNombre,
          usuarioId || null,
        );
        categoriaId = nuevaCat[0].id;
      }

      // 3. Principio Activo
      let principioActivoId: string | null = null;
      if (maestro.principio_activo?.trim()) {
        const paNombre = maestro.principio_activo.trim().toUpperCase();
        const paExistente: any[] = await tx.$queryRawUnsafe(
          `SELECT id FROM public.principios_activos 
           WHERE botica_id = $1::uuid AND LOWER(nombre) = LOWER($2) AND deleted_at IS NULL 
           LIMIT 1`,
          boticaId,
          paNombre,
        );

        if (paExistente.length > 0) {
          principioActivoId = paExistente[0].id;
        } else {
          const nuevoPa: any[] = await tx.$queryRawUnsafe(
            `INSERT INTO public.principios_activos (botica_id, nombre, created_by, updated_by)
             VALUES ($1::uuid, $2, $3::uuid, $3::uuid) RETURNING id`,
            boticaId,
            paNombre,
            usuarioId || null,
          );
          principioActivoId = nuevoPa[0].id;
        }
      }

      // 4. Forma Farmacéutica
      let formaFarmaceuticaId: string | null = null;
      if (maestro.forma_farmaceutica?.trim()) {
        const ffNombre = maestro.forma_farmaceutica.trim().toUpperCase();
        const ffExistente: any[] = await tx.$queryRawUnsafe(
          `SELECT id FROM public.formas_farmaceuticas 
           WHERE botica_id = $1::uuid AND LOWER(nombre) = LOWER($2) AND deleted_at IS NULL 
           LIMIT 1`,
          boticaId,
          ffNombre,
        );

        if (ffExistente.length > 0) {
          formaFarmaceuticaId = ffExistente[0].id;
        } else {
          const nuevaFf: any[] = await tx.$queryRawUnsafe(
            `INSERT INTO public.formas_farmaceuticas (botica_id, nombre, created_by, updated_by)
             VALUES ($1::uuid, $2, $3::uuid, $3::uuid) RETURNING id`,
            boticaId,
            ffNombre,
            usuarioId || null,
          );
          formaFarmaceuticaId = nuevaFf[0].id;
        }
      }

      // 5. Unidad de Presentación (Empaque)
      let unidadPresentacionId: string | null = null;
      const presNombre = (maestro.unidad_presentacion?.trim() || 'CAJA').toUpperCase();
      const presExistente: any[] = await tx.$queryRawUnsafe(
        `SELECT id FROM public.unidades_presentacion 
         WHERE botica_id = $1::uuid AND LOWER(nombre) = LOWER($2) AND deleted_at IS NULL 
         LIMIT 1`,
        boticaId,
        presNombre,
      );

      if (presExistente.length > 0) {
        unidadPresentacionId = presExistente[0].id;
      } else {
        const nuevaPres: any[] = await tx.$queryRawUnsafe(
          `INSERT INTO public.unidades_presentacion (botica_id, nombre, abreviatura, created_by, updated_by)
           VALUES ($1::uuid, $2, $3, $4::uuid, $4::uuid) RETURNING id`,
          boticaId,
          presNombre,
          presNombre.substring(0, 3).toUpperCase(),
          usuarioId || null,
        );
        unidadPresentacionId = nuevaPres[0].id;
      }

      // 6. Unidad Base (ej. TABLETA, CAPSULA, UNIDAD, etc.)
      let unidadBaseId: string | null = null;
      const baseNombre = (maestro.unidad_base?.trim() || 'UNIDAD').toUpperCase();
      const baseExistente: any[] = await tx.$queryRawUnsafe(
        `SELECT id FROM public.unidades_presentacion 
         WHERE botica_id = $1::uuid AND LOWER(nombre) = LOWER($2) AND deleted_at IS NULL 
         LIMIT 1`,
        boticaId,
        baseNombre,
      );

      if (baseExistente.length > 0) {
        unidadBaseId = baseExistente[0].id;
      } else {
        const nuevaBase: any[] = await tx.$queryRawUnsafe(
          `INSERT INTO public.unidades_presentacion (botica_id, nombre, abreviatura, created_by, updated_by)
           VALUES ($1::uuid, $2, $3, $4::uuid, $4::uuid) RETURNING id`,
          boticaId,
          baseNombre,
          baseNombre.substring(0, 3).toUpperCase(),
          usuarioId || null,
        );
        unidadBaseId = nuevaBase[0].id;
      }

      return {
        maestro,
        dependencias_locales: {
          laboratorio_id: laboratorioId,
          categoria_id: categoriaId,
          principio_activo_id: principioActivoId,
          forma_farmaceutica_id: formaFarmaceuticaId,
          presentacion_id: unidadPresentacionId,
          unidad_base_id: unidadBaseId,
          cantidad_unidad_base: maestro.cantidad_unidad_base || 1,
        },
      };
    });
  }

  /**
   * Carga una base de medicamentos populares si la tabla está vacía
   */
  async seedDatosIniciales() {
    try {
      const countResult: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as total FROM public.catalogo_maestro_productos`,
      );
      const total = Number(countResult[0]?.total ?? 0);
      if (total > 0) return;

      this.logger.log('Precargando catálogo maestro con productos comunes en MAYÚSCULAS...');

      const productosSeed = [
        {
          codigo_barras: '7750123456789',
          sku: 'MED-PAN-500',
          nombre_comercial: 'PANADOL 500MG',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'PARACETAMOL',
          concentracion: '500',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'TABLETA',
          via_administracion: 'ORAL',
          requiere_receta: false,
          afecto_igv: true,
          laboratorio: 'GSK',
          categoria: 'ANALGÉSICOS Y ANTIPIRÉTICOS',
          registro_sanitario: 'EN-01452',
          unidad_presentacion: 'CAJA',
          unidad_base: 'TABLETA',
          cantidad_unidad_base: 100,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750123456790',
          sku: 'MED-PAN-ANT',
          nombre_comercial: 'PANADOL ANTIGRIPAL NF',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'PARACETAMOL + FENILEFRINA + CLORFENAMINA',
          concentracion: '500',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'TABLETA RECUBIERTA',
          via_administracion: 'ORAL',
          requiere_receta: false,
          afecto_igv: true,
          laboratorio: 'GSK',
          categoria: 'ANTIGRIPALES Y RESFRIADO',
          registro_sanitario: 'EN-02381',
          unidad_presentacion: 'CAJA',
          unidad_base: 'TABLETA',
          cantidad_unidad_base: 80,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750987654321',
          sku: 'MED-AMOX-500',
          nombre_comercial: 'AMOXICILINA 500MG',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'AMOXICILINA',
          concentracion: '500',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'CÁPSULA',
          via_administracion: 'ORAL',
          requiere_receta: true,
          afecto_igv: true,
          laboratorio: 'GENFAR',
          categoria: 'ANTIBIÓTICOS',
          registro_sanitario: 'EN-03912',
          unidad_presentacion: 'CAJA',
          unidad_base: 'CÁPSULA',
          cantidad_unidad_base: 100,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750456123789',
          sku: 'MED-IBU-400',
          nombre_comercial: 'IBUPROFENO 400MG',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'IBUPROFENO',
          concentracion: '400',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'TABLETA RECUBIERTA',
          via_administracion: 'ORAL',
          requiere_receta: false,
          afecto_igv: true,
          laboratorio: 'PORTUGAL',
          categoria: 'ANTIINFLAMATORIOS',
          registro_sanitario: 'EN-04192',
          unidad_presentacion: 'CAJA',
          unidad_base: 'TABLETA',
          cantidad_unidad_base: 100,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750789456123',
          sku: 'MED-APR-550',
          nombre_comercial: 'APRONAX 550MG',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'NAPROXENO SÓDICO',
          concentracion: '550',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'TABLETA RECUBIERTA',
          via_administracion: 'ORAL',
          requiere_receta: false,
          afecto_igv: true,
          laboratorio: 'BAYER',
          categoria: 'ANTIINFLAMATORIOS Y ANALGÉSICOS',
          registro_sanitario: 'EN-05123',
          unidad_presentacion: 'CAJA',
          unidad_base: 'TABLETA',
          cantidad_unidad_base: 40,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750321654987',
          sku: 'MED-BISM-SUSP',
          nombre_comercial: 'BISMUTOL SUSPENSIÓN 262MG/15ML',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'SUBSALICILATO DE BISMUTO',
          concentracion: '262',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'SUSPENSIÓN ORAL',
          via_administracion: 'ORAL',
          requiere_receta: false,
          afecto_igv: true,
          laboratorio: 'MEDIFARMA',
          categoria: 'GASTROINTESTINAL',
          registro_sanitario: 'EN-06341',
          unidad_presentacion: 'FRASCO',
          unidad_base: 'FRASCO',
          cantidad_unidad_base: 1,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750111222333',
          sku: 'MED-OMEP-20',
          nombre_comercial: 'OMEPRAZOL 20MG',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'OMEPRAZOL',
          concentracion: '20',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'CÁPSULA',
          via_administracion: 'ORAL',
          requiere_receta: false,
          afecto_igv: true,
          laboratorio: 'FARMINDUSTRIA',
          categoria: 'GASTROINTESTINAL',
          registro_sanitario: 'EN-07821',
          unidad_presentacion: 'CAJA',
          unidad_base: 'CÁPSULA',
          cantidad_unidad_base: 30,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750999888777',
          sku: 'MED-AZIT-500',
          nombre_comercial: 'AZITROMICINA 500MG',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'AZITROMICINA',
          concentracion: '500',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'TABLETA RECUBIERTA',
          via_administracion: 'ORAL',
          requiere_receta: true,
          afecto_igv: true,
          laboratorio: 'GENFAR',
          categoria: 'ANTIBIÓTICOS',
          registro_sanitario: 'EN-08912',
          unidad_presentacion: 'CAJA',
          unidad_base: 'TABLETA',
          cantidad_unidad_base: 3,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750444555666',
          sku: 'MED-CET-10',
          nombre_comercial: 'CETIRIZINA 10MG',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'CETIRIZINA CLORHIDRATO',
          concentracion: '10',
          unidad_concentracion: 'MG',
          forma_farmaceutica: 'TABLETA',
          via_administracion: 'ORAL',
          requiere_receta: false,
          afecto_igv: true,
          laboratorio: 'PORTUGAL',
          categoria: 'ANTIALÉRGICOS Y ANTIHISTAMÍNICOS',
          registro_sanitario: 'EN-09234',
          unidad_presentacion: 'CAJA',
          unidad_base: 'TABLETA',
          cantidad_unidad_base: 100,
          controla_lote: true,
          requiere_vencimiento: true,
        },
        {
          codigo_barras: '7750888111222',
          sku: 'MED-SALB-INH',
          nombre_comercial: 'SALBUTAMOL 100MCG INHALADOR',
          tipo_producto: 'MEDICAMENTO',
          principio_activo: 'SALBUTAMOL',
          concentracion: '100',
          unidad_concentracion: 'MCG',
          forma_farmaceutica: 'AEROSOL PARA INHALACIÓN',
          via_administracion: 'INHALATORIA',
          requiere_receta: true,
          afecto_igv: true,
          laboratorio: 'GSK',
          categoria: 'RESPIRATORIO',
          registro_sanitario: 'EN-10456',
          unidad_presentacion: 'FRASCO',
          unidad_base: 'FRASCO',
          cantidad_unidad_base: 1,
          controla_lote: true,
          requiere_vencimiento: true,
        }
      ];

      for (const prod of productosSeed) {
        await this.create(prod as any);
      }

      this.logger.log(`Se insertaron ${productosSeed.length} productos semilla en el catálogo maestro.`);
    } catch (err: any) {
      this.logger.error(`Error en seed de catálogo maestro: ${err.message}`);
    }
  }
}
