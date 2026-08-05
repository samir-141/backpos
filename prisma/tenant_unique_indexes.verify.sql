-- Verification for migration 20260801040000_tenant_unique_indexes.
-- Run with the same database role used by Prisma migrations. The transaction
-- deliberately rolls back every probe row and never changes production data.

DO $indexes$
DECLARE
  missing_indexes text[];
  obsolete_indexes text[];
  expected RECORD;
  indexed_columns text[];
  is_unique boolean;
  predicate text;
BEGIN
  SELECT array_agg(expected.name ORDER BY expected.name)
  INTO missing_indexes
  FROM (
    VALUES
      ('idx_categorias_botica_nombre_activo'),
      ('idx_formas_farmaceuticas_botica_nombre_activo'),
      ('idx_laboratorios_botica_nombre_activo'),
      ('idx_permisos_botica_codigo_activo'),
      ('idx_principios_activos_botica_nombre_activo'),
      ('idx_productos_botica_sku_activo'),
      ('idx_productos_botica_codigo_interno_activo'),
      ('idx_presentaciones_botica_codigo_barras_activo'),
      ('idx_proveedores_botica_ruc_activo'),
      ('idx_roles_botica_nombre_activo'),
      ('idx_tipos_mov_botica_codigo_activo'),
      ('idx_unidades_presentacion_botica_nombre_activo'),
      ('idx_unidades_presentacion_botica_abrev_activo')
  ) AS expected(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = expected.name
      AND indexdef LIKE '%UNIQUE INDEX%'
  );

  IF missing_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan índices únicos tenant: %', missing_indexes;
  END IF;

  FOR expected IN
    SELECT * FROM (
      VALUES
        ('idx_categorias_botica_nombre_activo', 'nombre'),
        ('idx_formas_farmaceuticas_botica_nombre_activo', 'nombre'),
        ('idx_laboratorios_botica_nombre_activo', 'nombre'),
        ('idx_permisos_botica_codigo_activo', 'codigo'),
        ('idx_principios_activos_botica_nombre_activo', 'nombre'),
        ('idx_productos_botica_sku_activo', 'sku'),
        ('idx_productos_botica_codigo_interno_activo', 'codigo_interno'),
        ('idx_presentaciones_botica_codigo_barras_activo', 'codigo_barras'),
        ('idx_proveedores_botica_ruc_activo', 'ruc'),
        ('idx_roles_botica_nombre_activo', 'nombre'),
        ('idx_tipos_mov_botica_codigo_activo', 'codigo'),
        ('idx_unidades_presentacion_botica_nombre_activo', 'nombre'),
        ('idx_unidades_presentacion_botica_abrev_activo', 'abreviatura')
    ) AS definitions(index_name, field_name)
  LOOP
    SELECT
      array_agg(attribute.attname ORDER BY key.ordinality),
      definition.indisunique,
      pg_get_expr(definition.indpred, definition.indrelid)
    INTO indexed_columns, is_unique, predicate
    FROM pg_class AS index_class
    JOIN pg_namespace AS namespace ON namespace.oid = index_class.relnamespace
    JOIN pg_index AS definition ON definition.indexrelid = index_class.oid
    JOIN LATERAL unnest(definition.indkey)
      WITH ORDINALITY AS key(attnum, ordinality) ON true
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = definition.indrelid
      AND attribute.attnum = key.attnum
    WHERE namespace.nspname = current_schema()
      AND index_class.relname = expected.index_name
    GROUP BY definition.indisunique, definition.indpred, definition.indrelid;

    IF indexed_columns IS DISTINCT FROM ARRAY['botica_id', expected.field_name]
      OR is_unique IS DISTINCT FROM true
      OR predicate IS NULL
      OR predicate NOT ILIKE '%deleted_at%IS NULL%'
    THEN
      RAISE EXCEPTION
        'Definición inesperada para %: columnas=%, unique=%, predicate=%',
        expected.index_name,
        indexed_columns,
        is_unique,
        predicate;
    END IF;
  END LOOP;

  SELECT array_agg(indexname ORDER BY indexname)
  INTO obsolete_indexes
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND indexname = ANY (ARRAY[
      'idx_categorias_nombre_activo',
      'idx_formas_farmaceuticas_nombre_activo',
      'idx_laboratorios_nombre_activo',
      'idx_permisos_codigo_activo',
      'idx_principios_activos_nombre_activo',
      'idx_productos_sku_activo',
      'idx_productos_codigo_interno_activo',
      'idx_presentaciones_codigo_barras_activo',
      'idx_proveedores_ruc_activo',
      'idx_roles_nombre_activo',
      'idx_tipos_mov_codigo_activo',
      'idx_unidades_presentacion_nombre_activo',
      'idx_unidades_presentacion_abrev_activo'
    ]);

  IF obsolete_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'Persisten índices únicos globales obsoletos: %', obsolete_indexes;
  END IF;
END
$indexes$;

-- Semantic probe: the same role and permission are valid in two boticas,
-- while an active duplicate inside one botica must still be rejected.
BEGIN;
DO $probe$
DECLARE
  botica_a uuid := gen_random_uuid();
  botica_b uuid := gen_random_uuid();
  duplicate_rejected boolean := false;
BEGIN
  -- Prisma model `boticas` is mapped to the physical table `empresas`.
  INSERT INTO empresas (id, nombre, ruc, razon_social)
  VALUES
    (botica_a, '__TENANT_PROBE_A__', substring(md5(botica_a::text), 1, 11), '__TENANT_PROBE_A__'),
    (botica_b, '__TENANT_PROBE_B__', substring(md5(botica_b::text), 1, 11), '__TENANT_PROBE_B__');

  INSERT INTO roles (botica_id, nombre)
  VALUES (botica_a, '__TENANT_SHARED_ROLE__'), (botica_b, '__TENANT_SHARED_ROLE__');

  INSERT INTO permisos (botica_id, codigo, descripcion)
  VALUES
    (botica_a, '__tenant_shared_permission__', 'probe'),
    (botica_b, '__tenant_shared_permission__', 'probe');

  BEGIN
    INSERT INTO roles (botica_id, nombre)
    VALUES (botica_a, '__TENANT_SHARED_ROLE__');
  EXCEPTION
    WHEN unique_violation THEN
      duplicate_rejected := true;
  END;

  IF NOT duplicate_rejected THEN
    RAISE EXCEPTION 'El índice tenant permitió un rol activo duplicado dentro de la misma botica';
  END IF;

  INSERT INTO roles (botica_id, nombre, deleted_at)
  VALUES (botica_a, '__TENANT_SHARED_ROLE__', now());
END
$probe$;
ROLLBACK;

-- Reproducible RLS inventory. This is evidence only: DB-F4 does not enable,
-- force or alter policies because Prisma currently opens connections without
-- setting a transaction-local tenant identifier.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  p.polname AS policy_name,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_policy AS p ON p.polrelid = c.oid
WHERE n.nspname = current_schema()
  AND c.relname = ANY (ARRAY[
    'categorias',
    'formas_farmaceuticas',
    'laboratorios',
    'permisos',
    'principios_activos',
    'productos_comerciales',
    'productos_presentaciones',
    'proveedores',
    'roles',
    'tipos_movimientos_inventario',
    'unidades_presentacion'
  ])
ORDER BY c.relname, p.polname;
