// src/modules/productos/productos.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryProductosDto, OrdenProductos } from './dto/query-productos.dto';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { ProductoDetalleResponse } from './responses/producto-detalle.response';
import { ProductoListaResponse } from './responses/producto-lista.response';
import { ProductoMapper } from './mappers/producto.mapper';

import { RealtimeService } from '../../socket/realtime.service';

@Injectable()
export class ProductosService {
  private readonly logger = new Logger(ProductosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Obtiene el detalle completo de un producto por su ID.
   * Usa las relaciones de Prisma con includes anidados.
   */
  async findOne(boticaId: string, id: string): Promise<ProductoDetalleResponse> {
    this.logger.log(`Buscando producto por ID: ${id}`);

    const producto = await this.prisma.productos_comerciales.findFirst({
      where: {
        id,
        deleted_at: null,
        botica_id: boticaId,
      },
      include: {
        medicamentos: {
          include: {
            principios_activos: { select: { id: true, nombre: true } },
            formas_farmaceuticas: { select: { id: true, nombre: true } },
          },
        },
        laboratorios: { select: { id: true, nombre: true, pais: true } },
        categorias: { select: { id: true, nombre: true } },
        unidades_presentacion: {
          select: { id: true, nombre: true, abreviatura: true },
        },
        productos_presentaciones: {
          where: { deleted_at: null },
          include: {
            unidades_presentacion: {
              select: { id: true, nombre: true, abreviatura: true },
            },
          },
          orderBy: { orden: 'asc' },
        },
        lotes: {
          where: { botica_id: boticaId, deleted_at: null },
          select: {
            id: true,
            numero_lote: true,
            fecha_vencimiento: true,
            fecha_ingreso: true,
            stock_actual: true,
            precio_compra_unidad_base: true,
          },
          orderBy: [{ fecha_vencimiento: 'asc' }, { fecha_ingreso: 'asc' }],
        },
      },
    });

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return ProductoMapper.toDetalleResponse(producto);
  }

  /**
   * Lista productos usando la vista optimizada vw_productos_pos.
   * Soporta paginación, búsqueda y filtros.
   */
  async findAll(boticaId: string, query: QueryProductosDto): Promise<ProductoListaResponse> {
    const {
      page = 1,
      limit = 20,
      buscar,
      laboratorio_id,
      categoria_id,
      principio_activo_id,
      orden,
    } = query;
    const offset = (page - 1) * limit;

    this.logger.log(`Listando productos - Página: ${page}, Límite: ${limit}`);

    // Construimos los filtros dinámicamente
    const condiciones: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (buscar) {
      condiciones.push(`
        (LOWER(nombre_comercial) LIKE $${paramIndex}
         OR LOWER(sku) LIKE $${paramIndex}
         OR LOWER(codigo_barras) LIKE $${paramIndex}
         OR LOWER(codigo_interno) LIKE $${paramIndex})
      `);
      params.push(`%${buscar.toLowerCase()}%`);
      paramIndex++;
    }

    if (laboratorio_id) {
      condiciones.push(
        `laboratorio = (SELECT nombre FROM public.laboratorios WHERE id = $${paramIndex}::uuid)`,
      );
      params.push(laboratorio_id);
      paramIndex++;
    }

    if (categoria_id) {
      condiciones.push(
        `categoria = (SELECT nombre FROM public.categorias WHERE id = $${paramIndex}::uuid)`,
      );
      params.push(categoria_id);
      paramIndex++;
    }

    if (principio_activo_id) {
      condiciones.push(
        `principio_activo = (SELECT nombre FROM public.principios_activos WHERE id = $${paramIndex}::uuid)`,
      );
      params.push(principio_activo_id);
      paramIndex++;
    }

    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    if (query.sucursal_id && isUuid(query.sucursal_id)) {
      condiciones.push(
        `producto_comercial_id IN (SELECT DISTINCT producto_comercial_id FROM public.lotes WHERE sucursal_id = $${paramIndex}::uuid AND deleted_at IS NULL AND stock_actual > 0)`,
      );
      params.push(query.sucursal_id);
      paramIndex++;
    }

    const whereClause =
      condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const orderByClause = this.buildOrderBy(orden);

    // Agregar LIMIT y OFFSET a los parámetros
    params.push(limit, offset);

    // Consulta de datos con paginación
    const queryData = `
      SELECT * FROM public.vw_productos_pos
      ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Consulta de total (para metadata)
    const queryCount = `
      SELECT COUNT(*)::int AS total FROM public.vw_productos_pos
      ${whereClause}
    `;

    const [rows, countResult] = await Promise.all([
      this.prisma.queryRaw(queryData, params),
      this.prisma.queryRaw<{ total: number }>(queryCount, params.slice(0, -2)), // Sin LIMIT/OFFSET
    ]);

    // Convertir el total a Number
    const total = Number(countResult[0]?.total ?? 0);

    return {
      data: (rows as any[]).map(ProductoMapper.toListaItem),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Crea un nuevo producto comercial en la base de datos de manera transaccional,
   * o agrega una nueva presentación a un producto comercial existente.
   */
  async create(boticaId: string, dto: CreateProductoDto, usuarioId?: string) {
    if (!boticaId || !usuarioId) {
      throw new BadRequestException('No se pudo identificar la botica o el usuario que crea el producto.');
    }

    // El producto comercial pertenece a la botica; la sucursal se registra al
    // ingresar lotes/stock. Normalizamos antes de validar y persistir.
    dto = {
      ...dto,
      tipo_producto: String(dto.tipo_producto || 'MEDICAMENTO').trim().toUpperCase(),
      nombre_comercial: dto.nombre_comercial?.trim(),
      sku: dto.sku?.trim().toUpperCase(),
      codigo_interno: dto.codigo_interno?.trim() || undefined,
      codigo_barras: dto.codigo_barras?.trim() || undefined,
      registro_sanitario: dto.registro_sanitario?.trim() || undefined,
      presentaciones: dto.presentaciones?.map((pres) => ({
        ...pres,
        cantidad_unidad_base: Number(pres.cantidad_unidad_base),
        precio_actual: Number(pres.precio_actual),
        codigo_barras: pres.codigo_barras?.trim() || undefined,
      })),
    };
    const esMedicamento = dto.tipo_producto === 'MEDICAMENTO';
    const tiposPermitidos = ['MEDICAMENTO', 'HIGIENE', 'BEBE', 'COSMETICO', 'ACCESORIO', 'OTRO'];
    if (!tiposPermitidos.includes(dto.tipo_producto!)) {
      throw new BadRequestException('Tipo de producto no válido.');
    }
    const unidadBaseId = dto.unidad_base_id || dto.presentacion_id;
    const presentaciones = dto.presentaciones?.length
      ? dto.presentaciones
      : [{
          unidad_presentacion_id: dto.presentacion_id,
          cantidad_unidad_base: dto.cantidad_unidad_base,
          precio_actual: dto.precio_actual,
          codigo_barras: dto.codigo_barras,
        }];

    if (!unidadBaseId) {
      throw new BadRequestException('Debe seleccionar la unidad base del producto.');
    }
    const base = presentaciones.find(
      (p) => p.unidad_presentacion_id === unidadBaseId,
    );
    if (!dto.producto_comercial_id && (!base || Number(base.cantidad_unidad_base) !== 1)) {
      throw new BadRequestException(
        'La unidad base debe existir entre las presentaciones y equivaler a 1.',
      );
    }
    if (new Set(presentaciones.map((p) => p.unidad_presentacion_id)).size !== presentaciones.length) {
      throw new BadRequestException('No se puede repetir una presentación para el mismo producto.');
    }

    const validarReferencias = async (tx: any) => {
      const [principio, forma, laboratorio, categoria, ...unidades] = await Promise.all([
        dto.principio_activo_id ? tx.principios_activos.findFirst({ where: { id: dto.principio_activo_id, botica_id: boticaId, deleted_at: null }, select: { id: true } }) : null,
        dto.forma_farmaceutica_id ? tx.formas_farmaceuticas.findFirst({ where: { id: dto.forma_farmaceutica_id, botica_id: boticaId, deleted_at: null }, select: { id: true } }) : null,
        dto.laboratorio_id ? tx.laboratorios.findFirst({ where: { id: dto.laboratorio_id, botica_id: boticaId, deleted_at: null }, select: { id: true } }) : null,
        dto.categoria_id ? tx.categorias.findFirst({ where: { id: dto.categoria_id, botica_id: boticaId, deleted_at: null }, select: { id: true } }) : null,
        ...[...new Set(presentaciones.map((p) => p.unidad_presentacion_id))].map((id) => tx.unidades_presentacion.findFirst({ where: { id, botica_id: boticaId, deleted_at: null }, select: { id: true } })),
      ]);
      if ((esMedicamento && (!principio || !forma)) || !categoria || unidades.some((unidad) => !unidad) || (dto.laboratorio_id && !laboratorio)) {
        throw new BadRequestException('Uno o más catálogos seleccionados no existen, están inactivos o pertenecen a otra botica.');
      }
    };
    // --- CASO 1: AGREGAR PRESENTACION A PRODUCTO EXISTENTE ---
    if (dto.producto_comercial_id) {
      this.logger.log(
        `Agregando presentación a producto comercial existente: ${dto.producto_comercial_id}`,
      );

      // A. Verificar existencia del producto comercial
      const prod = await this.prisma.productos_comerciales.findFirst({
        where: { id: dto.producto_comercial_id, deleted_at: null, botica_id: boticaId },
      });
      if (!prod) {
        throw new NotFoundException(
          `Producto comercial con ID ${dto.producto_comercial_id} no encontrado`,
        );
      }

      // B. Validar que la presentación no exista ya para este producto
      const presExistente =
        await this.prisma.productos_presentaciones.findFirst({
          where: {
            producto_comercial_id: dto.producto_comercial_id,
            unidad_presentacion_id: dto.presentacion_id,
            deleted_at: null,
          },
        });
      if (presExistente) {
        throw new BadRequestException(
          'Esta presentación ya está registrada para el producto',
        );
      }

      // C. Validar código de barras único
      if (dto.codigo_barras) {
        const barrasExistente =
          await this.prisma.productos_presentaciones.findFirst({
            where: { codigo_barras: dto.codigo_barras, deleted_at: null },
          });
        if (barrasExistente) {
          throw new BadRequestException(
            `El código de barras "${dto.codigo_barras}" ya está registrado.`,
          );
        }
      }

      // D. Crear la presentación
      const presentacion = await this.prisma.productos_presentaciones.create({
        data: {
          botica_id: boticaId,
          producto_comercial_id: dto.producto_comercial_id,
          unidad_presentacion_id: dto.presentacion_id,
          cantidad_unidad_base: dto.cantidad_unidad_base,
          codigo_barras: dto.codigo_barras || null,
          precio_actual: dto.precio_actual,
          orden: 1,
          created_by: usuarioId,
        },
      });

      // E. Obtener el producto de la vista
      const rows = await this.prisma.queryRaw(
        `SELECT * FROM public.vw_productos_pos WHERE producto_comercial_id = $1::uuid AND presentacion_id = $2::uuid LIMIT 1`,
        [dto.producto_comercial_id, presentacion.id],
      );

      return rows?.length ? ProductoMapper.toListaItem(rows[0]) : {
        producto_comercial_id: dto.producto_comercial_id,
        presentacion_id: presentacion.id,
        mensaje: 'Presentación registrada correctamente.',
      };
    }

    // --- CASO 2: CREAR PRODUCTO NUEVO ---
    this.logger.log(
      `Creando nuevo producto comercial: ${dto.nombre_comercial}`,
    );

    // Validaciones obligatorias si es creación de cero
    if (
      !dto.nombre_comercial ||
      !dto.sku ||
      !dto.categoria_id ||
      !dto.presentacion_id ||
      dto.cantidad_unidad_base === undefined ||
      dto.precio_actual === undefined
    ) {
      throw new BadRequestException(
        'Faltan campos obligatorios para registrar un nuevo producto.',
      );
    }
    if (esMedicamento && (
      !dto.principio_activo_id ||
      !dto.forma_farmaceutica_id ||
      dto.concentracion === undefined ||
      !dto.unidad_concentracion ||
      !dto.via_administracion
    )) {
      throw new BadRequestException('La ficha farmacéutica requiere principio activo, forma, concentración y vía de administración.');
    }

    // 1. Validar SKU único en productos comerciales activos
    const skuExistente = await this.prisma.productos_comerciales.findFirst({
      where: { sku: dto.sku, deleted_at: null },
    });
    if (skuExistente) {
      throw new BadRequestException(`El SKU "${dto.sku}" ya está registrado.`);
    }

    // 2. Validar Código Interno único si se proporciona
    if (dto.codigo_interno) {
      const internoExistente =
        await this.prisma.productos_comerciales.findFirst({
          where: { codigo_interno: dto.codigo_interno, deleted_at: null },
        });
      if (internoExistente) {
        throw new BadRequestException(
          `El código interno "${dto.codigo_interno}" ya está registrado.`,
        );
      }
    }

    // 3. Validar Código de Barras único en presentaciones activas
    for (const pres of presentaciones.filter((p) => p.codigo_barras)) {
      const barrasExistente =
        await this.prisma.productos_presentaciones.findFirst({
          where: { codigo_barras: pres.codigo_barras, deleted_at: null },
        });
      if (barrasExistente) {
        throw new BadRequestException(
          `El código de barras "${pres.codigo_barras}" ya está registrado.`,
        );
      }
    }

    // 4. Ejecutar creación transaccional
    const result = await this.prisma.$transaction(async (tx) => {
      await validarReferencias(tx);
      // A. La ficha farmacéutica existe únicamente para medicamentos.
      let medicamento: any = null;
      if (esMedicamento) {
        medicamento = await tx.medicamentos.findFirst({
          where: {
            principio_activo_id: dto.principio_activo_id,
            forma_farmaceutica_id: dto.forma_farmaceutica_id,
            concentracion: dto.concentracion,
            unidad_concentracion: dto.unidad_concentracion,
            via_administracion: dto.via_administracion,
            deleted_at: null,
          },
        });
        if (!medicamento) {
          medicamento = await tx.medicamentos.create({
            data: {
              botica_id: boticaId,
              principio_activo_id: dto.principio_activo_id!,
              forma_farmaceutica_id: dto.forma_farmaceutica_id!,
              concentracion: dto.concentracion!,
              unidad_concentracion: dto.unidad_concentracion!,
              via_administracion: dto.via_administracion!,
              requiere_receta: dto.requiere_receta ?? false,
              afecto_igv: dto.afecto_igv ?? true,
              created_by: usuarioId,
            },
          });
        }
      }

// B. Crear Producto Comercial
       const productoComercial = await tx.productos_comerciales.create({
         data: {
           botica_id: boticaId,
           nombre_comercial: dto.nombre_comercial!,
           sku: dto.sku!,
           codigo_interno: dto.codigo_interno || null,
           registro_sanitario: dto.registro_sanitario || null,
           medicamento_id: medicamento?.id || null,
           laboratorio_id: dto.laboratorio_id || null,
           categoria_id: dto.categoria_id!,
           unidad_base_id: unidadBaseId,
           tipo_producto: dto.tipo_producto,
           controla_lote: dto.controla_lote ?? true,
           requiere_vencimiento: dto.requiere_vencimiento ?? esMedicamento,
           atributos: dto.atributos || null,
           estado: 'ACTIVO',
           created_by: usuarioId,
         },
       });

      // C. Crear presentaciones individualmente para conservar el ID real de
      // la fila. La vista POS usa pp.id, no unidad_presentacion_id.
      const presentacionesCreadas = [];
      for (const [index, pres] of presentaciones.entries()) {
        presentacionesCreadas.push(await tx.productos_presentaciones.create({
          data: {
          botica_id: boticaId,
          producto_comercial_id: productoComercial.id,
          unidad_presentacion_id: pres.unidad_presentacion_id,
          cantidad_unidad_base: Number(pres.cantidad_unidad_base),
          codigo_barras: pres.codigo_barras?.trim() || null,
          precio_actual: Number(pres.precio_actual),
          orden: index + 1,
          created_by: usuarioId,
        },
        }));
      }
      const presentacionBase = presentacionesCreadas.find(
        (pres: any) => pres.unidad_presentacion_id === unidadBaseId,
      );
      if (!presentacionBase) {
        throw new BadRequestException('No se pudo crear la presentación base del producto.');
      }

      return {
        productoComercialId: productoComercial.id,
        presentacionId: presentacionBase.id,
      };
    });

    // 5. Devolver el producto formateado como ProductoListaItemResponse consultando la vista
    const rows = await this.prisma.queryRaw(
      `SELECT * FROM public.vw_productos_pos WHERE producto_comercial_id = $1::uuid AND presentacion_id = $2::uuid LIMIT 1`,
      [result.productoComercialId, result.presentacionId],
    );

    // La creación ya fue confirmada por la transacción. Nunca reportamos un
    // 404 después de guardar: ante una vista desactualizada devolvemos IDs
    // válidos para que el frontend recargue el listado.
    return rows?.length ? ProductoMapper.toListaItem(rows[0]) : {
      producto_comercial_id: result.productoComercialId,
      presentacion_id: result.presentacionId,
      mensaje: 'Producto creado correctamente. Actualiza el listado para visualizarlo.',
    };
  }

  /**
   * Busca un producto comercial existente o una presentación por SKU, código de barras o código interno.
   */
  async buscarPorIdentificador(boticaId: string, valor: string) {
    this.logger.log(`Buscando producto existente por identificador: ${valor}`);

    if (!valor || !valor.trim()) {
      throw new BadRequestException(
        'Debe proporcionar un identificador de búsqueda',
      );
    }

    const cleanVal = valor.trim();

    // 1. Buscar en presentaciones por código de barras
    const pres = await this.prisma.productos_presentaciones.findFirst({
      where: { codigo_barras: cleanVal, botica_id: boticaId, deleted_at: null },
      include: {
        productos_comerciales: {
          include: {
            medicamentos: {
              include: {
                principios_activos: { select: { id: true, nombre: true } },
                formas_farmaceuticas: { select: { id: true, nombre: true } },
              },
            },
            laboratorios: { select: { id: true, nombre: true } },
            categorias: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    if (pres) {
      return {
        encontrado: true,
        tipo: 'PRESENTACION',
        producto_comercial_id: pres.producto_comercial_id,
        nombre_comercial: pres.productos_comerciales.nombre_comercial,
        sku: pres.productos_comerciales.sku,
        codigo_interno: pres.productos_comerciales.codigo_interno,
        tipo_producto: pres.productos_comerciales.tipo_producto,
        principio_activo_id:
          pres.productos_comerciales.medicamentos?.principio_activo_id || null,
        forma_farmaceutica_id:
          pres.productos_comerciales.medicamentos?.forma_farmaceutica_id || null,
        laboratorio_id: pres.productos_comerciales.laboratorio_id,
        categoria_id: pres.productos_comerciales.categoria_id,
        concentracion: Number(
          pres.productos_comerciales.medicamentos?.concentracion || 0,
        ),
        unidad_concentracion:
          pres.productos_comerciales.medicamentos?.unidad_concentracion || null,
        via_administracion:
          pres.productos_comerciales.medicamentos?.via_administracion || null,
        requiere_receta:
          pres.productos_comerciales.medicamentos?.requiere_receta || false,
        afecto_igv: pres.productos_comerciales.medicamentos?.afecto_igv ?? true,
      };
    }

    // 2. Buscar en productos comerciales por SKU o Código Interno
    const prod = await this.prisma.productos_comerciales.findFirst({
      where: {
        OR: [{ sku: cleanVal }, { codigo_interno: cleanVal }],
        botica_id: boticaId,
        deleted_at: null,
      },
      include: {
        medicamentos: {
          include: {
            principios_activos: { select: { id: true, nombre: true } },
            formas_farmaceuticas: { select: { id: true, nombre: true } },
          },
        },
        laboratorios: { select: { id: true, nombre: true } },
        categorias: { select: { id: true, nombre: true } },
      },
    });

    if (prod) {
      return {
        encontrado: true,
        tipo: 'PRODUCTO_COMERCIAL',
        producto_comercial_id: prod.id,
        nombre_comercial: prod.nombre_comercial,
        sku: prod.sku,
        codigo_interno: prod.codigo_interno,
        tipo_producto: prod.tipo_producto,
        principio_activo_id: prod.medicamentos?.principio_activo_id || null,
        forma_farmaceutica_id: prod.medicamentos?.forma_farmaceutica_id || null,
        laboratorio_id: prod.laboratorio_id,
        categoria_id: prod.categoria_id,
        concentracion: Number(prod.medicamentos?.concentracion || 0),
        unidad_concentracion: prod.medicamentos.unidad_concentracion,
        via_administracion: prod.medicamentos.via_administracion,
        requiere_receta: prod.medicamentos.requiere_receta,
        afecto_igv: prod.medicamentos.afecto_igv,
      };
    }

    return { encontrado: false };
  }

  /**
   * Actualiza los campos editables del producto comercial y su respectiva presentación.
   */
  async update(boticaId: string, id: string, dto: UpdateProductoDto) {
    this.logger.log(`Actualizando producto por ID: ${id}`);

    // 1. Verificar que el producto comercial exista
    const productoComercial = await this.prisma.productos_comerciales.findFirst(
      {
        where: { id, deleted_at: null, botica_id: boticaId },
      },
    );
    if (!productoComercial) {
      throw new NotFoundException(
        `Producto comercial con ID ${id} no encontrado`,
      );
    }

    // 2. Si se cambia el código de barras, validar que sea único
    if (dto.codigo_barras) {
      const barrasExistente =
        await this.prisma.productos_presentaciones.findFirst({
          where: {
            codigo_barras: dto.codigo_barras,
            deleted_at: null,
            NOT: { producto_comercial_id: id }, // Permitir el mismo producto
          },
        });
      if (barrasExistente) {
        throw new BadRequestException(
          `El código de barras "${dto.codigo_barras}" ya está registrado.`,
        );
      }
    }

    // 3. Ejecutar actualizaciones en transacción
    const updatedPresentacionId = await this.prisma.$transaction(async (tx) => {
      // A. Si se envían datos del producto comercial (nombre_comercial, registro_sanitario)
      if (
        dto.nombre_comercial !== undefined ||
        dto.registro_sanitario !== undefined ||
        dto.tipo_producto !== undefined ||
        dto.atributos !== undefined ||
        dto.controla_lote !== undefined ||
        dto.requiere_vencimiento !== undefined
      ) {
        const updateProdComercial: any = {};
        if (dto.nombre_comercial !== undefined)
          updateProdComercial.nombre_comercial = dto.nombre_comercial;
        if (dto.registro_sanitario !== undefined)
          updateProdComercial.registro_sanitario =
            dto.registro_sanitario || null;
        if (dto.tipo_producto !== undefined) updateProdComercial.tipo_producto = dto.tipo_producto;
        if (dto.atributos !== undefined) updateProdComercial.atributos = dto.atributos || null;
        if (dto.controla_lote !== undefined) updateProdComercial.controla_lote = dto.controla_lote;
        if (dto.requiere_vencimiento !== undefined) updateProdComercial.requiere_vencimiento = dto.requiere_vencimiento;

        await tx.productos_comerciales.update({
          where: { id },
          data: updateProdComercial,
        });
      }

      // B. Si se envían flags del medicamento, actualizar el medicamento correspondiente
      if ((dto.requiere_receta !== undefined || dto.afecto_igv !== undefined) && productoComercial.medicamento_id) {
        const updateData: any = {};
        if (dto.requiere_receta !== undefined)
          updateData.requiere_receta = dto.requiere_receta;
        if (dto.afecto_igv !== undefined)
          updateData.afecto_igv = dto.afecto_igv;

        await tx.medicamentos.update({
          where: { id: productoComercial.medicamento_id },
          data: updateData,
        });
      }

      // B. Si se edita la presentación específica (precio y código de barras)
      let presentacionId =
        dto.presentacion_id || productoComercial.unidad_base_id;

      // Buscamos si existe la presentación para este producto
      const presentacion = await tx.productos_presentaciones.findFirst({
        where: {
          producto_comercial_id: id,
          OR: [
            { id: presentacionId },
            { unidad_presentacion_id: presentacionId },
          ],
          deleted_at: null,
        },
      });

      if (presentacion) {
        // La UI envía el ID de productos_presentaciones. La vista también usa pp.id.
        presentacionId = presentacion.id;
        const updatePresData: any = {};
        if (dto.precio_actual !== undefined)
          updatePresData.precio_actual = dto.precio_actual;
        if (dto.codigo_barras !== undefined)
          updatePresData.codigo_barras = dto.codigo_barras || null;

        await tx.productos_presentaciones.update({
          where: { id: presentacion.id },
          data: updatePresData,
        });
      } else {
        // Si no la encuentra, intentamos con la primera presentación
        const primeraPres = await tx.productos_presentaciones.findFirst({
          where: { producto_comercial_id: id, deleted_at: null },
        });
        if (primeraPres) {
          presentacionId = primeraPres.id;
          const updatePresData: any = {};
          if (dto.precio_actual !== undefined)
            updatePresData.precio_actual = dto.precio_actual;
          if (dto.codigo_barras !== undefined)
            updatePresData.codigo_barras = dto.codigo_barras || null;

          await tx.productos_presentaciones.update({
            where: { id: primeraPres.id },
            data: updatePresData,
          });
        }
      }

      return presentacionId;
    });

    // 4. Retornar el producto actualizado consultando la vista
    const rows = await this.prisma.queryRaw(
      `SELECT * FROM public.vw_productos_pos WHERE producto_comercial_id = $1::uuid AND presentacion_id = $2::uuid LIMIT 1`,
      [id, updatedPresentacionId],
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException('Error al recuperar el producto actualizado');
    }

    return ProductoMapper.toListaItem(rows[0]);
  }

  /**
   * Realiza soft delete de un producto comercial y de todas sus presentaciones asociadas.
   */
  async remove(boticaId: string, id: string): Promise<{ mensaje: string }> {
    this.logger.log(`Eliminando (soft delete) producto con ID: ${id}`);

    // 1. Verificar si existe y no está eliminado
    const producto = await this.prisma.productos_comerciales.findFirst({
      where: { id, deleted_at: null, botica_id: boticaId },
    });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    // 2. Ejecutar soft delete en cascada
    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      // A. Soft delete producto comercial
      await tx.productos_comerciales.update({
        where: { id },
        data: { deleted_at: ahora },
      });

      // B. Soft delete sus presentaciones correspondientes
      await tx.productos_presentaciones.updateMany({
        where: { producto_comercial_id: id, deleted_at: null },
        data: { deleted_at: ahora },
      });
    });

    return { mensaje: 'Producto eliminado correctamente' };
  }

  /**
   * Reabastecimiento masivo de stock para un producto comercial (+500 unidades base)
   */
  async reabastecerStock(boticaId: string, dto: {
    producto_comercial_id: string;
    sucursal_id?: string;
    numero_lote: string;
    fecha_vencimiento?: string;
    stock_adicional: number;
    precio_compra_base: number;
  }, usuarioId: string) {
    const numeroLote = dto.numero_lote?.trim().toUpperCase() || '';
    this.logger.log(
      `Reabasteciendo ${dto.stock_adicional} unidades para el producto: ${dto.producto_comercial_id}`,
    );

    let sucursalId = dto.sucursal_id;
    if (!sucursalId || sucursalId === 'undefined' || sucursalId === 'null') {
      const sucursal = await this.prisma.sucursales.findFirst({
        where: { deleted_at: null, botica_id: boticaId },
      });
      if (!sucursal)
        throw new BadRequestException(
          'No hay ninguna sucursal activa en el sistema.',
        );
      sucursalId = sucursal.id;
    }

    const producto = await this.prisma.productos_comerciales.findFirst({
      where: { id: dto.producto_comercial_id, deleted_at: null, botica_id: boticaId },
    });
    if (!producto) {
      throw new NotFoundException(
        `Producto comercial con ID ${dto.producto_comercial_id} no encontrado.`,
      );
    }

    const requiereVencimiento = producto.requiere_vencimiento;
    let vencimientoSolicitado: Date | null = null;
    if (requiereVencimiento) {
      if (!dto.fecha_vencimiento) {
        throw new BadRequestException('La fecha de vencimiento es obligatoria para este producto.');
      }
      const [anioVencimiento, mesVencimiento, diaVencimiento] = dto.fecha_vencimiento
        .slice(0, 10)
        .split('-')
        .map(Number);
      vencimientoSolicitado = new Date(anioVencimiento, mesVencimiento - 1, diaVencimiento);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (Number.isNaN(vencimientoSolicitado.getTime()) || vencimientoSolicitado < hoy) {
        throw new BadRequestException('No se puede ingresar stock con una fecha de vencimiento pasada.');
      }
    }

    if (!usuarioId) {
      throw new BadRequestException('No se pudo identificar al usuario que registra el ingreso.');
    }

    // El código incluye la botica porque el esquema actual tiene unicidad global para códigos.
    // Así cada botica conserva su propio tipo de movimiento y su historial queda aislado.
    const codigoTipoIngreso = `INGRESO_${boticaId.replace(/-/g, '').slice(0, 12)}`;
    let tipoIngreso = await this.prisma.tipos_movimientos_inventario.findFirst({
      where: { botica_id: boticaId, codigo: codigoTipoIngreso, deleted_at: null },
    });
    if (!tipoIngreso) {
      tipoIngreso = await this.prisma.tipos_movimientos_inventario.create({
        data: {
          botica_id: boticaId,
          codigo: codigoTipoIngreso,
          descripcion: 'Ingreso manual de lote',
          afecta_stock: 1,
          created_by: usuarioId,
        },
      });
    }

    const registrarIngreso = async (loteId: string, stockAnterior: number, stockNuevo: number) => {
      return this.prisma.movimientos_inventario.create({
        data: {
          lote_id: loteId,
          botica_id: boticaId,
          tipo_movimiento_id: tipoIngreso.id,
          usuario_id: usuarioId,
          cantidad: Number(dto.stock_adicional),
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          documento_referencia: numeroLote || 'SIN-LOTE',
          observacion: `Ingreso manual del ${producto.controla_lote ? `lote ${numeroLote}` : 'producto sin control de lote'}`,
          created_by: usuarioId,
        },
      });
    };

    const registrarInversionInventario = async (movimientoId: string) => {
      // Cada ingreso manual es una salida real de dinero para adquirir mercadería.
      // Queda registrado para que la meta de recuperación no dependa de valores fijos.
      await this.prisma.gastos_operativos.create({
        data: {
          botica_id: boticaId,
          sucursal_id: sucursalId,
          tipo: 'INVERSION',
          categoria: 'COMPRA_INVENTARIO',
          descripcion: `Compra de inventario: ${producto.controla_lote ? `lote ${numeroLote}` : 'producto sin lote'}`,
          monto: Number(dto.stock_adicional) * Number(dto.precio_compra_base),
          comprobante: `MOV-${movimientoId}`,
        },
      });
    };

    const loteExistente = await this.prisma.lotes.findFirst({
      where: {
        producto_comercial_id: dto.producto_comercial_id,
        sucursal_id: sucursalId,
        botica_id: boticaId,
        numero_lote: numeroLote,
        deleted_at: null,
      },
    });

    if (loteExistente) {
      if (
        loteExistente.fecha_vencimiento?.toISOString().slice(0, 10) !==
        vencimientoSolicitado?.toISOString().slice(0, 10)
      ) {
        throw new BadRequestException(
          `El lote ${numeroLote} ya existe y tiene una fecha de vencimiento distinta. No se puede mezclar con otro vencimiento.`,
        );
      }
      const loteActualizado = await this.prisma.lotes.update({
        where: { id: loteExistente.id },
        data: {
          stock_actual:
            loteExistente.stock_actual + Number(dto.stock_adicional),
          precio_compra_unidad_base:
            dto.precio_compra_base || loteExistente.precio_compra_unidad_base,
          updated_by: usuarioId,
        },
      });
      const movimiento = await registrarIngreso(
        loteActualizado.id,
        loteExistente.stock_actual,
        loteActualizado.stock_actual,
      );
      await registrarInversionInventario(movimiento.id);
      // Realtime broadcast
      this.realtimeService.notificarStockActualizado(sucursalId, dto.producto_comercial_id, loteActualizado.stock_actual);
      this.realtimeService.notificarGeneral({
        titulo: 'Reabastecimiento de Stock',
        mensaje: `Stock incrementado en +${dto.stock_adicional} unidades para el lote ${numeroLote}`,
        tipo: 'SUCCESS',
        sucursalId,
      });

      return {
        exito: true,
        mensaje: `Stock incrementado exitosamente en +${dto.stock_adicional} unidades para el lote ${numeroLote}`,
        lote: loteActualizado,
      };
    } else {
      const nuevoLote = await this.prisma.lotes.create({
        data: {
          botica_id: boticaId,
          producto_comercial_id: dto.producto_comercial_id,
          sucursal_id: sucursalId,
          numero_lote:
            numeroLote || `SIN-LOTE-${Date.now().toString().slice(-6)}`,
          fecha_vencimiento: vencimientoSolicitado,
          precio_compra_unidad_base: dto.precio_compra_base || 0,
          stock_actual: Number(dto.stock_adicional),
          created_by: usuarioId,
        },
      });
      const movimiento = await registrarIngreso(nuevoLote.id, 0, nuevoLote.stock_actual);
      await registrarInversionInventario(movimiento.id);

      // Realtime broadcast
      this.realtimeService.notificarStockActualizado(sucursalId, dto.producto_comercial_id, nuevoLote.stock_actual);
      this.realtimeService.notificarGeneral({
        titulo: 'Nuevo Lote Registrado',
        mensaje: `Registrado lote ${nuevoLote.numero_lote} con +${dto.stock_adicional} unidades base`,
        tipo: 'SUCCESS',
        sucursalId,
      });

      return {
        exito: true,
        mensaje: `Nuevo lote ${nuevoLote.numero_lote} registrado con ${dto.stock_adicional} unidades base`,
        lote: nuevoLote,
      };
    }
  }

  /**
   * Configurar o actualizar presentaciones de venta unificadas por producto (Caja, Blíster, Unidad, Frasco)
   */
  async actualizarPresentaciones(
    boticaId: string,
    productoComercialId: string,
    presentaciones: Array<{
      unidad_presentacion_id?: string;
      nombre?: string;
      cantidad_unidad_base: number;
      precio_actual: number;
      codigo_barras?: string;
    }>,
  ) {
    this.logger.log(
      `Actualizando presentaciones unificadas para el producto ${productoComercialId}`,
    );

    const producto = await this.prisma.productos_comerciales.findFirst({
      where: { id: productoComercialId, deleted_at: null, botica_id: boticaId },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const unidades = await this.prisma.unidades_presentacion.findMany({
      where: { botica_id: boticaId, deleted_at: null },
    });
    if (unidades.length === 0) {
      throw new BadRequestException('No hay unidades de presentación configuradas para esta botica.');
    }
    const unidadDefault = unidades[0].id;

    return await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < presentaciones.length; i++) {
        const pres = presentaciones[i];
        let presUnitId = pres.unidad_presentacion_id;

        if (!presUnitId && pres.nombre) {
          const busq = unidades.find((u) =>
            u.nombre.toLowerCase().includes(pres.nombre!.toLowerCase()),
          );
          presUnitId = busq?.id || unidadDefault;
        } else if (!presUnitId) {
          presUnitId = unidadDefault;
        }

        const existente = await tx.productos_presentaciones.findFirst({
          where: {
            producto_comercial_id: productoComercialId,
            unidad_presentacion_id: presUnitId,
            deleted_at: null,
          },
        });

        if (existente) {
          await tx.productos_presentaciones.update({
            where: { id: existente.id },
            data: {
              cantidad_unidad_base: Number(pres.cantidad_unidad_base),
              precio_actual: Number(pres.precio_actual),
              codigo_barras: pres.codigo_barras || existente.codigo_barras,
              orden: i + 1,
            },
          });
        } else {
          await tx.productos_presentaciones.create({
            data: {
              botica_id: boticaId,
              producto_comercial_id: productoComercialId,
              unidad_presentacion_id: presUnitId,
              cantidad_unidad_base: Number(pres.cantidad_unidad_base),
              precio_actual: Number(pres.precio_actual),
              codigo_barras: pres.codigo_barras || null,
              orden: i + 1,
            },
          });
        }
      }

      return {
        exito: true,
        mensaje: 'Presentaciones unificadas actualizadas correctamente',
      };
    });
  }

  /**
   * Construye la cláusula ORDER BY según el enum de ordenamiento
   */
  private buildOrderBy(orden?: OrdenProductos): string {
    switch (orden) {
      case OrdenProductos.NOMBRE_DESC:
        return 'ORDER BY nombre_comercial DESC';
      case OrdenProductos.PRECIO_ASC:
        return 'ORDER BY precio_actual ASC';
      case OrdenProductos.PRECIO_DESC:
        return 'ORDER BY precio_actual DESC';
      case OrdenProductos.STOCK_ASC:
        return 'ORDER BY stock_total ASC';
      case OrdenProductos.STOCK_DESC:
        return 'ORDER BY stock_total DESC';
      case OrdenProductos.NOMBRE_ASC:
      default:
        return 'ORDER BY nombre_comercial ASC';
    }
  }
}
