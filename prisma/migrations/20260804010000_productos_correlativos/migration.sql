-- CreateTable
CREATE TABLE IF NOT EXISTS "correlativos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correlativos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "idx_correlativos_botica_tipo"
    ON "correlativos" ("botica_id", "tipo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_correlativos_botica_id"
    ON "correlativos" ("botica_id");
