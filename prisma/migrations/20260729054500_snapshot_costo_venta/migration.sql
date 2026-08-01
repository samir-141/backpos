ALTER TABLE public.detalles_ventas
  ADD COLUMN IF NOT EXISTS costo_unitario_base DECIMAL(15,4);

-- Historial existente: se conserva el mejor dato disponible del lote asociado.
UPDATE public.detalles_ventas dv
SET costo_unitario_base = l.precio_compra_unidad_base
FROM public.lotes l
WHERE l.id = dv.lote_id
  AND dv.costo_unitario_base IS NULL;
