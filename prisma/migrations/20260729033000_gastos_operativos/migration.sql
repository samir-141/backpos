CREATE TABLE "gastos_operativos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "sucursal_id" UUID,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'OPERATIVO',
    "categoria" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),
    "monto" DECIMAL(15,2) NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobante" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "gastos_operativos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "gastos_operativos_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT "gastos_operativos_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT "gastos_operativos_monto_positivo" CHECK ("monto" > 0),
    CONSTRAINT "gastos_operativos_tipo_valido" CHECK ("tipo" IN ('OPERATIVO', 'INVERSION'))
);

CREATE INDEX "idx_gastos_operativos_botica_fecha" ON "gastos_operativos"("botica_id", "fecha");
CREATE INDEX "idx_gastos_operativos_sucursal" ON "gastos_operativos"("sucursal_id");
