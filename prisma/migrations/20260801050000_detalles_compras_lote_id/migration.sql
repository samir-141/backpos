-- Expand: Agrega lote_id en detalles_compras para trazabilidad directa de lotes creados o reutilizados.
ALTER TABLE "detalles_compras"
ADD COLUMN IF NOT EXISTS "lote_id" UUID;

-- Llave foránea hacia la tabla lotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'detalles_compras_lote_id_fkey'
  ) THEN
    ALTER TABLE "detalles_compras"
    ADD CONSTRAINT "detalles_compras_lote_id_fkey"
    FOREIGN KEY ("lote_id")
    REFERENCES "lotes"("id")
    ON DELETE SET NULL
    ON UPDATE NO ACTION;
  END IF;
END $$;

-- Índice para optimizar consultas de compras por lote
CREATE INDEX IF NOT EXISTS "idx_detalles_compras_lote_id"
ON "detalles_compras" ("lote_id")
WHERE "deleted_at" IS NULL;
