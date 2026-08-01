-- Expand-only: las ventas históricas permanecen válidas con clave NULL.
-- La aplicación nueva genera/acepta UUID y la unicidad queda aislada por botica.
ALTER TABLE "ventas"
ADD COLUMN "idempotency_key" UUID;

CREATE UNIQUE INDEX "uq_ventas_botica_idempotency_key"
ON "ventas" ("botica_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
