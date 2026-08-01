-- Tenant-scoped uniqueness for records owned by a botica.
--
-- This migration intentionally does not enable RLS and does not modify global
-- identities such as boticas.ruc, usuarios.correo or public tokens.
-- New composite indexes are built before the stricter global indexes are
-- removed, so a failure leaves the previous protection intact.

DO $preflight$
DECLARE
  collision RECORD;
BEGIN
  SELECT *
  INTO collision
  FROM (
    SELECT 'categorias' AS tabla, 'nombre' AS campo, botica_id, nombre::text AS valor, count(*) AS cantidad
    FROM categorias WHERE deleted_at IS NULL GROUP BY botica_id, nombre HAVING count(*) > 1
    UNION ALL
    SELECT 'formas_farmaceuticas', 'nombre', botica_id, nombre::text, count(*)
    FROM formas_farmaceuticas WHERE deleted_at IS NULL GROUP BY botica_id, nombre HAVING count(*) > 1
    UNION ALL
    SELECT 'laboratorios', 'nombre', botica_id, nombre::text, count(*)
    FROM laboratorios WHERE deleted_at IS NULL GROUP BY botica_id, nombre HAVING count(*) > 1
    UNION ALL
    SELECT 'permisos', 'codigo', botica_id, codigo::text, count(*)
    FROM permisos WHERE deleted_at IS NULL GROUP BY botica_id, codigo HAVING count(*) > 1
    UNION ALL
    SELECT 'principios_activos', 'nombre', botica_id, nombre::text, count(*)
    FROM principios_activos WHERE deleted_at IS NULL GROUP BY botica_id, nombre HAVING count(*) > 1
    UNION ALL
    SELECT 'productos_comerciales', 'sku', botica_id, sku::text, count(*)
    FROM productos_comerciales WHERE deleted_at IS NULL AND sku IS NOT NULL GROUP BY botica_id, sku HAVING count(*) > 1
    UNION ALL
    SELECT 'productos_comerciales', 'codigo_interno', botica_id, codigo_interno::text, count(*)
    FROM productos_comerciales WHERE deleted_at IS NULL AND codigo_interno IS NOT NULL GROUP BY botica_id, codigo_interno HAVING count(*) > 1
    UNION ALL
    SELECT 'productos_presentaciones', 'codigo_barras', botica_id, codigo_barras::text, count(*)
    FROM productos_presentaciones WHERE deleted_at IS NULL AND codigo_barras IS NOT NULL GROUP BY botica_id, codigo_barras HAVING count(*) > 1
    UNION ALL
    SELECT 'proveedores', 'ruc', botica_id, ruc::text, count(*)
    FROM proveedores WHERE deleted_at IS NULL GROUP BY botica_id, ruc HAVING count(*) > 1
    UNION ALL
    SELECT 'roles', 'nombre', botica_id, nombre::text, count(*)
    FROM roles WHERE deleted_at IS NULL GROUP BY botica_id, nombre HAVING count(*) > 1
    UNION ALL
    SELECT 'tipos_movimientos_inventario', 'codigo', botica_id, codigo::text, count(*)
    FROM tipos_movimientos_inventario WHERE deleted_at IS NULL GROUP BY botica_id, codigo HAVING count(*) > 1
    UNION ALL
    SELECT 'unidades_presentacion', 'nombre', botica_id, nombre::text, count(*)
    FROM unidades_presentacion WHERE deleted_at IS NULL GROUP BY botica_id, nombre HAVING count(*) > 1
    UNION ALL
    SELECT 'unidades_presentacion', 'abreviatura', botica_id, abreviatura::text, count(*)
    FROM unidades_presentacion WHERE deleted_at IS NULL GROUP BY botica_id, abreviatura HAVING count(*) > 1
  ) AS collisions
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format(
        'Preflight tenant unique falló: %s.%s tiene %s filas activas para botica_id=%s y valor=%L',
        collision.tabla,
        collision.campo,
        collision.cantidad,
        collision.botica_id,
        collision.valor
      ),
      HINT = 'Resuelva la duplicidad dentro de la misma botica antes de volver a ejecutar la migración.';
  END IF;
END
$preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_categorias_botica_nombre_activo"
  ON "categorias" ("botica_id", "nombre") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_formas_farmaceuticas_botica_nombre_activo"
  ON "formas_farmaceuticas" ("botica_id", "nombre") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_laboratorios_botica_nombre_activo"
  ON "laboratorios" ("botica_id", "nombre") WHERE "deleted_at" IS NULL;
-- roles/permisos were already corrected by
-- 20260731180000_administracion_general. Their preflight and final verification
-- remain here so schema drift cannot pass unnoticed.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_principios_activos_botica_nombre_activo"
  ON "principios_activos" ("botica_id", "nombre") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_productos_botica_sku_activo"
  ON "productos_comerciales" ("botica_id", "sku")
  WHERE "deleted_at" IS NULL AND "sku" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_productos_botica_codigo_interno_activo"
  ON "productos_comerciales" ("botica_id", "codigo_interno")
  WHERE "deleted_at" IS NULL AND "codigo_interno" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_presentaciones_botica_codigo_barras_activo"
  ON "productos_presentaciones" ("botica_id", "codigo_barras")
  WHERE "deleted_at" IS NULL AND "codigo_barras" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_proveedores_botica_ruc_activo"
  ON "proveedores" ("botica_id", "ruc") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tipos_mov_botica_codigo_activo"
  ON "tipos_movimientos_inventario" ("botica_id", "codigo") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_unidades_presentacion_botica_nombre_activo"
  ON "unidades_presentacion" ("botica_id", "nombre") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_unidades_presentacion_botica_abrev_activo"
  ON "unidades_presentacion" ("botica_id", "abreviatura") WHERE "deleted_at" IS NULL;

DROP INDEX IF EXISTS "idx_categorias_nombre_activo";
DROP INDEX IF EXISTS "idx_formas_farmaceuticas_nombre_activo";
DROP INDEX IF EXISTS "idx_laboratorios_nombre_activo";
DROP INDEX IF EXISTS "idx_permisos_codigo_activo";
DROP INDEX IF EXISTS "idx_principios_activos_nombre_activo";
DROP INDEX IF EXISTS "idx_productos_sku_activo";
DROP INDEX IF EXISTS "idx_productos_codigo_interno_activo";
DROP INDEX IF EXISTS "idx_presentaciones_codigo_barras_activo";
DROP INDEX IF EXISTS "idx_proveedores_ruc_activo";
DROP INDEX IF EXISTS "idx_roles_nombre_activo";
DROP INDEX IF EXISTS "idx_tipos_mov_codigo_activo";
DROP INDEX IF EXISTS "idx_unidades_presentacion_nombre_activo";
DROP INDEX IF EXISTS "idx_unidades_presentacion_abrev_activo";
