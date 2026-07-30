-- =========================================================
-- Script: create_views.sql
-- Descripción: Crea la vista materializada vw_productos_pos
--              necesaria para el módulo de Productos del POS.
-- =========================================================

CREATE OR REPLACE VIEW public.vw_productos_pos AS
SELECT
    -- Identificadores principales
    pc.id                                                  AS producto_comercial_id,
    pp.id                                                  AS presentacion_id,
    pc.botica_id,

    -- Datos del producto comercial
    pc.nombre_comercial,
    pc.sku,
    pc.codigo_interno,
    pc.registro_sanitario,
    pc.estado,

    -- Presentación
    up.nombre                                              AS presentacion_nombre,
    up.abreviatura                                         AS presentacion_abreviatura,
    pp.cantidad_unidad_base,
    pp.codigo_barras,
    pp.precio_actual,
    pp.orden,

    -- Categoría
    cat.id                                                 AS categoria_id,
    cat.nombre                                             AS categoria,

    -- Laboratorio
    lab.id                                                 AS laboratorio_id,
    lab.nombre                                             AS laboratorio,

    -- Medicamento / Principio Activo
    med.id                                                 AS medicamento_id,
    med.requiere_receta,
    med.afecto_igv,
    med.concentracion,
    med.unidad_concentracion,
    med.via_administracion,

    -- Principio activo
    pa.id                                                  AS principio_activo_id,
    pa.nombre                                              AS principio_activo,

    -- Forma farmacéutica
    ff.id                                                  AS forma_farmaceutica_id,
    ff.nombre                                              AS forma_farmaceutica,

    -- Unidad base
    ub.nombre                                              AS unidad_base_nombre,
    ub.abreviatura                                         AS unidad_base_abreviatura,

    -- Stock disponible: solamente lotes activos y no vencidos.
    COALESCE(
        (
            SELECT SUM(l.stock_actual)
            FROM public.lotes l
            WHERE l.producto_comercial_id = pc.id
              AND l.deleted_at IS NULL
              AND l.stock_actual > 0
              AND l.fecha_vencimiento >= CURRENT_DATE
        ), 0
    )::int                                                 AS stock_total,

    -- Vencimiento más próximo (FEFO)
    (
        SELECT MIN(l.fecha_vencimiento)
        FROM public.lotes l
        WHERE l.producto_comercial_id = pc.id
          AND l.deleted_at IS NULL
          AND l.stock_actual > 0
          AND l.fecha_vencimiento >= CURRENT_DATE
    )                                                      AS fecha_vencimiento_proximo,

    -- Timestamps
    pc.created_at,
    pc.updated_at,
    pc.deleted_at,

    -- Lote que el POS debe consumir primero (FEFO), sin considerar vencidos.
    (
        SELECT l.numero_lote
        FROM public.lotes l
        WHERE l.producto_comercial_id = pc.id
          AND l.deleted_at IS NULL
          AND l.stock_actual > 0
          AND l.fecha_vencimiento >= CURRENT_DATE
        ORDER BY l.fecha_vencimiento ASC, l.fecha_ingreso ASC NULLS LAST
        LIMIT 1
    )                                                      AS lote_fefo_numero,
    (
        SELECT l.fecha_vencimiento
        FROM public.lotes l
        WHERE l.producto_comercial_id = pc.id
          AND l.deleted_at IS NULL
          AND l.stock_actual > 0
          AND l.fecha_vencimiento >= CURRENT_DATE
        ORDER BY l.fecha_vencimiento ASC, l.fecha_ingreso ASC NULLS LAST
        LIMIT 1
    )                                                      AS lote_fefo_vencimiento

FROM public.productos_presentaciones pp
INNER JOIN public.productos_comerciales pc
    ON pc.id = pp.producto_comercial_id
   AND pc.deleted_at IS NULL
LEFT JOIN public.categorias cat
    ON cat.id = pc.categoria_id
LEFT JOIN public.laboratorios lab
    ON lab.id = pc.laboratorio_id
LEFT JOIN public.medicamentos med
    ON med.id = pc.medicamento_id
LEFT JOIN public.principios_activos pa
    ON pa.id = med.principio_activo_id
LEFT JOIN public.formas_farmaceuticas ff
    ON ff.id = med.forma_farmaceutica_id
LEFT JOIN public.unidades_presentacion up
    ON up.id = pp.unidad_presentacion_id
LEFT JOIN public.unidades_presentacion ub
    ON ub.id = pc.unidad_base_id
WHERE pp.deleted_at IS NULL;
