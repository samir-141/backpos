-- Roles y permisos son propios de cada botica. Antes se bloqueaba la creación
-- de una segunda empresa porque nombre/codigo eran únicos globalmente.
DROP INDEX IF EXISTS public.idx_roles_nombre_activo;
DROP INDEX IF EXISTS public.idx_permisos_codigo_activo;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_botica_nombre_activo
  ON public.roles (botica_id, nombre)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_permisos_botica_codigo_activo
  ON public.permisos (botica_id, codigo)
  WHERE deleted_at IS NULL;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS es_super_admin boolean NOT NULL DEFAULT false;
