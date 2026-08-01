-- Productos generales (pañales, higiene, accesorios) no requieren ficha médica.
ALTER TABLE public.productos_comerciales
  ALTER COLUMN medicamento_id DROP NOT NULL,
  ALTER COLUMN laboratorio_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tipo_producto varchar(30) NOT NULL DEFAULT 'MEDICAMENTO',
  ADD COLUMN IF NOT EXISTS controla_lote boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requiere_vencimiento boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS atributos jsonb;

CREATE INDEX IF NOT EXISTS idx_productos_tipo_producto
  ON public.productos_comerciales (botica_id, tipo_producto)
  WHERE deleted_at IS NULL;

DROP VIEW IF EXISTS public.vw_productos_pos CASCADE;
CREATE OR REPLACE VIEW public.vw_productos_pos AS
SELECT
    pc.id AS producto_comercial_id, pp.id AS presentacion_id, pc.botica_id,
    pc.nombre_comercial, pc.sku, pc.codigo_interno, pc.registro_sanitario, pc.estado,
    up.nombre AS presentacion_nombre, up.abreviatura AS presentacion_abreviatura,
    pp.cantidad_unidad_base, pp.codigo_barras, pp.precio_actual, pp.orden,
    cat.id AS categoria_id, cat.nombre AS categoria, lab.id AS laboratorio_id, lab.nombre AS laboratorio,
    med.id AS medicamento_id, COALESCE(med.requiere_receta, false) AS requiere_receta,
    COALESCE(med.afecto_igv, true) AS afecto_igv, med.concentracion, med.unidad_concentracion, med.via_administracion,
    pa.id AS principio_activo_id, pa.nombre AS principio_activo, ff.id AS forma_farmaceutica_id, ff.nombre AS forma_farmaceutica,
    ub.nombre AS unidad_base_nombre, ub.abreviatura AS unidad_base_abreviatura,
    COALESCE((SELECT SUM(l.stock_actual) FROM public.lotes l WHERE l.producto_comercial_id = pc.id AND l.deleted_at IS NULL AND l.stock_actual > 0 AND l.fecha_vencimiento >= CURRENT_DATE), 0)::int AS stock_total,
    (SELECT MIN(l.fecha_vencimiento) FROM public.lotes l WHERE l.producto_comercial_id = pc.id AND l.deleted_at IS NULL AND l.stock_actual > 0 AND l.fecha_vencimiento >= CURRENT_DATE) AS fecha_vencimiento_proximo,
    pc.created_at, pc.updated_at, pc.deleted_at,
    (SELECT l.numero_lote FROM public.lotes l WHERE l.producto_comercial_id = pc.id AND l.deleted_at IS NULL AND l.stock_actual > 0 AND l.fecha_vencimiento >= CURRENT_DATE ORDER BY l.fecha_vencimiento ASC, l.fecha_ingreso ASC NULLS LAST LIMIT 1) AS lote_fefo_numero,
    (SELECT l.fecha_vencimiento FROM public.lotes l WHERE l.producto_comercial_id = pc.id AND l.deleted_at IS NULL AND l.stock_actual > 0 AND l.fecha_vencimiento >= CURRENT_DATE ORDER BY l.fecha_vencimiento ASC, l.fecha_ingreso ASC NULLS LAST LIMIT 1) AS lote_fefo_vencimiento,
    pc.tipo_producto, pc.controla_lote, pc.requiere_vencimiento, pc.atributos
FROM public.productos_presentaciones pp
JOIN public.productos_comerciales pc ON pc.id = pp.producto_comercial_id AND pc.deleted_at IS NULL
LEFT JOIN public.categorias cat ON cat.id = pc.categoria_id
LEFT JOIN public.laboratorios lab ON lab.id = pc.laboratorio_id
LEFT JOIN public.medicamentos med ON med.id = pc.medicamento_id
LEFT JOIN public.principios_activos pa ON pa.id = med.principio_activo_id
LEFT JOIN public.formas_farmaceuticas ff ON ff.id = med.forma_farmaceutica_id
LEFT JOIN public.unidades_presentacion up ON up.id = pp.unidad_presentacion_id
LEFT JOIN public.unidades_presentacion ub ON ub.id = pc.unidad_base_id
WHERE pp.deleted_at IS NULL;
