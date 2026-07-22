// src/modules/productos/mappers/producto.mapper.ts
import { ProductoDetalleResponse } from '../responses/producto-detalle.response';
import { ProductoListaItemResponse } from '../responses/producto-lista.response';

/**
 * Convierte cualquier valor (Decimal, BigInt, string, number, null) a number de forma segura.
 * Esto es CRÍTICO porque @prisma/adapter-pg y pg nativo devuelven BigInt para COUNT(*) y SUM().
 */
const toNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    // Si es BigInt, lo convertimos a Number
    if (typeof value === 'bigint') return Number(value);
    // Si es number, lo retornamos tal cual
    if (typeof value === 'number') return value;
    // Si es string o Decimal de Prisma, lo parseamos
    return Number(value.toString());
};

/**
 * Convierte específicamente a entero (para campos como stock, cantidad, orden)
 */
const toInt = (value: any): number => {
    return Math.floor(toNumber(value));
};

export class ProductoMapper {
    static toDetalleResponse(producto: any): ProductoDetalleResponse {
        return {
            id: producto.id,
            sku: producto.sku,
            nombre_comercial: producto.nombre_comercial,
            registro_sanitario: producto.registro_sanitario,
            codigo_interno: producto.codigo_interno,
            estado: producto.estado,
            created_at: producto.created_at,
            medicamento: {
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
            },
            laboratorio: {
                id: producto.laboratorios.id,
                nombre: producto.laboratorios.nombre,
                pais: producto.laboratorios.pais,
            },
            categoria: {
                id: producto.categorias.id,
                nombre: producto.categorias.nombre,
            },
            unidad_base: {
                id: producto.unidades_presentacion.id,
                nombre: producto.unidades_presentacion.nombre,
                abreviatura: producto.unidades_presentacion.abreviatura,
            },
            presentaciones: (producto.productos_presentaciones ?? []).map((pres: any) => ({
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
        };
    }

    static toListaItem(row: any): ProductoListaItemResponse {
        return {
            producto_comercial_id: row.producto_comercial_id,
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
            presentacion_nombre: row.unidad_presentacion,
            unidad_abreviatura: row.unidad_abreviatura,
            cantidad_unidad_base: toInt(row.cantidad_unidad_base), // ✅ Convertido
            precio_actual: toNumber(row.precio_actual),
            codigo_barras: row.codigo_barras,
            stock_total: toInt(row.stock_total), // ✅ Convertido (viene de SUM)
            lote_fefo_numero: row.lote_fefo_numero,
            lote_fefo_vencimiento: row.lote_fefo_vencimiento,
        };
    }
}