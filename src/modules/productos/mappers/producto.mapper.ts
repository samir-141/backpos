// src/modules/productos/mappers/producto.mapper.ts
import { ProductoDetalleResponse } from '../responses/producto-detalle.response';
import { ProductoListaItemResponse } from '../responses/producto-lista.response';

export interface ProductoListaCamposExtendidos {
  tipo_producto: string;
  controla_lote: boolean;
  requiere_vencimiento: boolean;
  atributos: unknown;
}

interface IdNombre {
  id: string;
  nombre: string;
}

type NumericValue =
  number | string | bigint | null | undefined | { toString(): string };

interface UnidadEntrada extends IdNombre {
  abreviatura: string;
}

interface MedicamentoEntrada {
  id: string;
  concentracion: NumericValue;
  unidad_concentracion: string;
  via_administracion: string;
  requiere_receta: boolean;
  afecto_igv: boolean;
  principios_activos: IdNombre;
  formas_farmaceuticas: IdNombre;
}

interface PresentacionEntrada {
  id: string;
  cantidad_unidad_base: NumericValue;
  codigo_barras: string | null;
  precio_actual: NumericValue;
  orden: NumericValue;
  unidades_presentacion: UnidadEntrada;
}

interface LoteEntrada {
  id: string;
  numero_lote: string;
  fecha_fabricacion: Date | null;
  fecha_vencimiento: Date | null;
  fecha_ingreso?: Date | null;
  stock_actual: NumericValue;
  precio_compra_unidad_base: NumericValue;
}

export interface ProductoDetalleEntrada {
  id: string;
  sku: string | null;
  nombre_comercial: string;
  registro_sanitario: string | null;
  codigo_interno: string | null;
  estado: string;
  created_at: Date | null;
  tipo_producto?: string | null;
  controla_lote: boolean;
  requiere_vencimiento: boolean;
  atributos?: unknown;
  medicamentos?: MedicamentoEntrada | null;
  laboratorios?: (IdNombre & { pais?: string | null }) | null;
  categorias: IdNombre;
  unidades_presentacion: UnidadEntrada;
  productos_presentaciones?: PresentacionEntrada[];
  lotes?: LoteEntrada[];
}

export interface ProductoListaFila {
  producto_comercial_id: string;
  tipo_producto?: string | null;
  controla_lote: boolean;
  requiere_vencimiento: boolean;
  atributos?: unknown;
  nombre_comercial: string;
  sku: string | null;
  codigo_interno: string | null;
  principio_activo: string;
  forma_farmaceutica: string;
  concentracion: NumericValue;
  unidad_concentracion: string;
  via_administracion: string;
  requiere_receta: boolean;
  afecto_igv: boolean;
  laboratorio: string;
  categoria: string;
  presentacion_id: string;
  presentacion_nombre: string;
  presentacion_abreviatura?: string | null;
  unidad_base_abreviatura: string;
  cantidad_unidad_base: NumericValue;
  precio_actual: NumericValue;
  codigo_barras: string | null;
  stock_total: NumericValue;
  lote_fefo_numero: string | null;
  lote_fefo_vencimiento: Date | null;
  registro_sanitario?: string | null;
}

/**
 * Convierte cualquier valor (Decimal, BigInt, string, number, null) a number de forma segura.
 * Esto es CRÍTICO porque @prisma/adapter-pg y pg nativo devuelven BigInt para COUNT(*) y SUM().
 */
const toNumber = (value: NumericValue): number => {
  if (value === null || value === undefined) return 0;
  // Si es BigInt, lo convertimos a Number
  if (typeof value === 'bigint') return Number(value);
  // Si es number, lo retornamos tal cual
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number(value.toString());
};

/**
 * Convierte específicamente a entero (para campos como stock, cantidad, orden)
 */
const toInt = (value: NumericValue): number => {
  return Math.floor(toNumber(value));
};

export class ProductoMapper {
  static toDetalleResponse(
    producto: ProductoDetalleEntrada,
  ): ProductoDetalleResponse {
    return {
      id: producto.id,
      sku: producto.sku,
      nombre_comercial: producto.nombre_comercial,
      registro_sanitario: producto.registro_sanitario,
      codigo_interno: producto.codigo_interno,
      estado: producto.estado,
      created_at: producto.created_at,
      tipo_producto: producto.tipo_producto || 'MEDICAMENTO',
      controla_lote: Boolean(producto.controla_lote),
      requiere_vencimiento: Boolean(producto.requiere_vencimiento),
      atributos: producto.atributos ?? null,
      medicamento: producto.medicamentos
        ? {
            id: producto.medicamentos.id,
            concentracion: toNumber(producto.medicamentos.concentracion),
            unidad_concentracion: producto.medicamentos.unidad_concentracion,
            via_administracion: producto.medicamentos.via_administracion,
            requiere_receta: producto.medicamentos.requiere_receta,
            afecto_igv: producto.medicamentos.afecto_igv,
            principio_activo: {
              id: producto.medicamentos.principios_activos.id,
              nombre: producto.medicamentos.principios_activos.nombre,
            },
            forma_farmaceutica: {
              id: producto.medicamentos.formas_farmaceuticas.id,
              nombre: producto.medicamentos.formas_farmaceuticas.nombre,
            },
          }
        : null,
      laboratorio: producto.laboratorios
        ? {
            id: producto.laboratorios.id,
            nombre: producto.laboratorios.nombre,
            pais: producto.laboratorios.pais,
          }
        : null,
      categoria: {
        id: producto.categorias.id,
        nombre: producto.categorias.nombre,
      },
      unidad_base: {
        id: producto.unidades_presentacion.id,
        nombre: producto.unidades_presentacion.nombre,
        abreviatura: producto.unidades_presentacion.abreviatura,
      },
      presentaciones: (producto.productos_presentaciones ?? []).map((pres) => ({
        id: pres.id,
        cantidad_unidad_base: toInt(pres.cantidad_unidad_base), // ✅ Convertido
        codigo_barras: pres.codigo_barras,
        precio_actual: toNumber(pres.precio_actual),
        orden: pres.orden !== null ? toInt(pres.orden) : null, // ✅ Convertido
        unidad_presentacion: {
          id: pres.unidades_presentacion.id,
          nombre: pres.unidades_presentacion.nombre,
          abreviatura: pres.unidades_presentacion.abreviatura,
        },
      })),
      lotes: (producto.lotes ?? []).map((lote) => ({
        id: lote.id,
        numero_lote: lote.numero_lote,
        fecha_fabricacion: lote.fecha_fabricacion,
        fecha_vencimiento: lote.fecha_vencimiento,
        fecha_ingreso: lote.fecha_ingreso,
        stock_actual: toInt(lote.stock_actual),
        precio_compra_unidad_base: toNumber(lote.precio_compra_unidad_base),
      })),
    };
  }

  static toListaItem(
    row: ProductoListaFila,
  ): ProductoListaItemResponse & ProductoListaCamposExtendidos {
    return {
      producto_comercial_id: row.producto_comercial_id,
      tipo_producto: row.tipo_producto || 'MEDICAMENTO',
      controla_lote: Boolean(row.controla_lote),
      requiere_vencimiento: Boolean(row.requiere_vencimiento),
      atributos: row.atributos ?? null,
      nombre_comercial: row.nombre_comercial,
      sku: row.sku,
      codigo_interno: row.codigo_interno,
      principio_activo: row.principio_activo,
      forma_farmaceutica: row.forma_farmaceutica,
      concentracion: toNumber(row.concentracion),
      unidad_concentracion: row.unidad_concentracion,
      via_administracion: row.via_administracion,
      requiere_receta: row.requiere_receta,
      afecto_igv: row.afecto_igv,
      laboratorio: row.laboratorio,
      categoria: row.categoria,
      presentacion_id: row.presentacion_id,
      // vw_productos_pos entrega el nombre de la presentación de venta
      // (Tableta, Blíster, Caja), no la unidad base del producto.
      presentacion_nombre: row.presentacion_nombre,
      unidad_abreviatura:
        row.presentacion_abreviatura || row.unidad_base_abreviatura,
      cantidad_unidad_base: toInt(row.cantidad_unidad_base), // ✅ Convertido
      precio_actual: toNumber(row.precio_actual),
      codigo_barras: row.codigo_barras,
      stock_total: toInt(row.stock_total), // ✅ Convertido (viene de SUM)
      lote_fefo_numero: row.lote_fefo_numero,
      lote_fefo_vencimiento: row.lote_fefo_vencimiento,
      registro_sanitario: row.registro_sanitario || null,
    };
  }
}
