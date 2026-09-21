-- Migration: Corregir unicidad de metodos_pago para que sea multitenant (botica_id, nombre)
-- El índice previo idx_metodos_pago_nombre_activo fue creado sobre ("nombre") en lugar de ("botica_id", "nombre").

DROP INDEX IF EXISTS "idx_metodos_pago_nombre_activo";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_metodos_pago_nombre_activo"
  ON "metodos_pago" ("botica_id", "nombre")
  WHERE "deleted_at" IS NULL;
