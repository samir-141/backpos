-- Los ingresos manuales de lote anteriores no generaban un gasto de inversión.
-- Se registran una sola vez para que el payback refleje el dinero realmente invertido.
INSERT INTO public.gastos_operativos (
    botica_id, sucursal_id, tipo, categoria, descripcion, monto,
    fecha, comprobante
)
SELECT
    m.botica_id,
    l.sucursal_id,
    'INVERSION',
    'COMPRA_INVENTARIO',
    'Compra de inventario: lote ' || l.numero_lote,
    m.cantidad * l.precio_compra_unidad_base,
    COALESCE(m.fecha, m.created_at, CURRENT_TIMESTAMP),
    'MOV-' || m.id::text
FROM public.movimientos_inventario m
JOIN public.lotes l ON l.id = m.lote_id
WHERE m.deleted_at IS NULL
  AND m.cantidad > 0
  AND m.observacion LIKE 'Ingreso manual del lote%'
  AND NOT EXISTS (
      SELECT 1
      FROM public.gastos_operativos g
      WHERE g.deleted_at IS NULL
        AND g.comprobante = 'MOV-' || m.id::text
  );
