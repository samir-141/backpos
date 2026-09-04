-- CreateTable: perfiles_tributarios
CREATE TABLE IF NOT EXISTS "perfiles_tributarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nombre_comercial" VARCHAR(200),
    "tipo_contribuyente" VARCHAR(30) NOT NULL DEFAULT 'PERSONA_NATURAL',
    "regimen_tributario" VARCHAR(30) NOT NULL DEFAULT 'NRUS',
    "direccion_fiscal" VARCHAR(250) NOT NULL,
    "ubigeo" VARCHAR(6),
    "departamento" VARCHAR(100),
    "provincia" VARCHAR(100),
    "distrito" VARCHAR(100),
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "estado_sunat" VARCHAR(50) DEFAULT 'ACTIVO',
    "condicion_sunat" VARCHAR(50) DEFAULT 'HABIDO',
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "perfiles_tributarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable: configuraciones_emision
CREATE TABLE IF NOT EXISTS "configuraciones_emision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "perfil_tributario_id" UUID NOT NULL,
    "sistema_emision" VARCHAR(40) NOT NULL DEFAULT 'SEE_CONTRIBUYENTE',
    "proveedor_tipo" VARCHAR(40) NOT NULL DEFAULT 'SUNAT_DIRECTO',
    "ambiente" VARCHAR(20) NOT NULL DEFAULT 'BETA',
    "sol_usuario_encriptado" TEXT,
    "sol_clave_encriptada" TEXT,
    "certificado_nombre" VARCHAR(200),
    "certificado_path" TEXT,
    "certificado_clave_encriptada" TEXT,
    "certificado_fecha_vencimiento" TIMESTAMPTZ(6),
    "pse_id" VARCHAR(100),
    "ose_id" VARCHAR(100),
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "configuraciones_emision_pkey" PRIMARY KEY ("id")
);

-- Add columns to existing tables
ALTER TABLE "series_documentos" ADD COLUMN IF NOT EXISTS "perfil_tributario_id" UUID;
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "perfil_tributario_id" UUID;
ALTER TABLE "comprobantes_electronicos" ADD COLUMN IF NOT EXISTS "perfil_tributario_id" UUID;

-- Unique & Index constraints
CREATE UNIQUE INDEX IF NOT EXISTS "uq_perfiles_tributarios_botica_ruc" ON "perfiles_tributarios"("botica_id", "ruc") WHERE ("deleted_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_perfiles_tributarios_botica_id" ON "perfiles_tributarios"("botica_id");
CREATE INDEX IF NOT EXISTS "idx_perfiles_tributarios_ruc" ON "perfiles_tributarios"("ruc");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_config_emision_perfil" ON "configuraciones_emision"("perfil_tributario_id");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_perfiles_tributarios_botica') THEN
        ALTER TABLE "perfiles_tributarios" ADD CONSTRAINT "fk_perfiles_tributarios_botica" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_emision_perfil') THEN
        ALTER TABLE "configuraciones_emision" ADD CONSTRAINT "fk_config_emision_perfil" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_series_documentos_perfil_tributario') THEN
        ALTER TABLE "series_documentos" ADD CONSTRAINT "fk_series_documentos_perfil_tributario" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ventas_perfil_tributario') THEN
        ALTER TABLE "ventas" ADD CONSTRAINT "fk_ventas_perfil_tributario" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comprobantes_perfil_tributario') THEN
        ALTER TABLE "comprobantes_electronicos" ADD CONSTRAINT "fk_comprobantes_perfil_tributario" FOREIGN KEY ("perfil_tributario_id") REFERENCES "perfiles_tributarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

-- Data migration: Migrate existing configuraciones_tributarias to perfiles_tributarios & configuraciones_emision
DO $$
DECLARE
    r RECORD;
    new_profile_id UUID;
BEGIN
    FOR r IN SELECT * FROM "configuraciones_tributarias" WHERE "deleted_at" IS NULL LOOP
        IF NOT EXISTS (SELECT 1 FROM "perfiles_tributarios" WHERE "botica_id" = r.botica_id AND "ruc" = r.ruc) THEN
            INSERT INTO "perfiles_tributarios" (
                "botica_id", "ruc", "razon_social", "nombre_comercial",
                "tipo_contribuyente", "regimen_tributario", "direccion_fiscal",
                "ubigeo", "departamento", "provincia", "distrito",
                "es_principal", "activo", "created_by", "updated_by", "created_at", "updated_at"
            ) VALUES (
                r.botica_id, r.ruc, r.razon_social, r.nombre_comercial,
                CASE WHEN r.ruc LIKE '20%' THEN 'PERSONA_JURIDICA' ELSE 'PERSONA_NATURAL' END,
                r.regimen_tributario, r.direccion_fiscal,
                r.ubigeo, r.departamento, r.provincia, r.distrito,
                true, r.activo, r.created_by, r.updated_by, r.created_at, r.updated_at
            ) RETURNING "id" INTO new_profile_id;

            INSERT INTO "configuraciones_emision" (
                "perfil_tributario_id", "sistema_emision", "proveedor_tipo", "ambiente",
                "sol_usuario_encriptado", "sol_clave_encriptada",
                "certificado_nombre", "certificado_path", "certificado_clave_encriptada",
                "certificado_fecha_vencimiento", "verificado", "activo",
                "created_by", "updated_by", "created_at", "updated_at"
            ) VALUES (
                new_profile_id,
                CASE WHEN r.regimen_tributario = 'NRUS' THEN 'SEE_CF' ELSE 'SEE_CONTRIBUYENTE' END,
                r.proveedor_facturacion, r.ambiente,
                r.sol_usuario_encriptado, r.sol_clave_encriptada,
                r.certificado_nombre, r.certificado_path, r.certificado_clave_encriptada,
                r.certificado_fecha_vencimiento,
                (r.sol_usuario_encriptado IS NOT NULL AND r.sol_clave_encriptada IS NOT NULL),
                r.activo, r.created_by, r.updated_by, r.created_at, r.updated_at
            );

            -- Link existing series_documentos, ventas, and comprobantes of this botica to this new_profile_id
            UPDATE "series_documentos" SET "perfil_tributario_id" = new_profile_id WHERE "botica_id" = r.botica_id AND "perfil_tributario_id" IS NULL;
            UPDATE "ventas" SET "perfil_tributario_id" = new_profile_id WHERE "botica_id" = r.botica_id AND "perfil_tributario_id" IS NULL;
            UPDATE "comprobantes_electronicos" SET "perfil_tributario_id" = new_profile_id WHERE "botica_id" = r.botica_id AND "perfil_tributario_id" IS NULL;
        END IF;
    END LOOP;
END $$;
