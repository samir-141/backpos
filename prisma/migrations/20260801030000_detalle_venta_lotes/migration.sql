-- Expand-only: conserva lote_id en detalles_ventas para compatibilidad histórica.
-- Los detalles nuevos guardan el factor de conversión usado al vender.
ALTER TABLE "detalles_ventas"
ADD COLUMN IF NOT EXISTS "unidades_base_por_presentacion" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_detalles_ventas_unidades_base_presentacion_positivas'
  ) THEN
    ALTER TABLE "detalles_ventas"
    ADD CONSTRAINT "ck_detalles_ventas_unidades_base_presentacion_positivas"
    CHECK (
      "unidades_base_por_presentacion" IS NULL
      OR "unidades_base_por_presentacion" > 0
    ) NOT VALID;
  END IF;
END $$;

-- Distribución exacta de cada detalle comercial entre los lotes FEFO consumidos.
CREATE TABLE IF NOT EXISTS "detalle_venta_lotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "botica_id" UUID NOT NULL,
  "detalle_venta_id" UUID NOT NULL,
  "lote_id" UUID NOT NULL,
  "unidades_base" INTEGER NOT NULL,
  "costo_unitario_base" DECIMAL(15, 4) NOT NULL,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "detalle_venta_lotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_detalle_venta_lotes_unidades_positivas" CHECK ("unidades_base" > 0),
  CONSTRAINT "ck_detalle_venta_lotes_costo_no_negativo" CHECK ("costo_unitario_base" >= 0),
  CONSTRAINT "fk_detalle_venta_lotes_botica" FOREIGN KEY ("botica_id")
    REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT "fk_detalle_venta_lotes_detalle" FOREIGN KEY ("detalle_venta_id")
    REFERENCES "detalles_ventas"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "fk_detalle_venta_lotes_lote" FOREIGN KEY ("lote_id")
    REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_detalle_venta_lotes_detalle_lote"
ON "detalle_venta_lotes" ("detalle_venta_id", "lote_id");

CREATE INDEX IF NOT EXISTS "idx_detalle_venta_lotes_botica_id"
ON "detalle_venta_lotes" ("botica_id");

CREATE INDEX IF NOT EXISTS "idx_detalle_venta_lotes_detalle_id"
ON "detalle_venta_lotes" ("detalle_venta_id");

CREATE INDEX IF NOT EXISTS "idx_detalle_venta_lotes_lote_id"
ON "detalle_venta_lotes" ("lote_id");
