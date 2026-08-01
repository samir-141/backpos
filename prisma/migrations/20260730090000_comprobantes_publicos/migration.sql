CREATE TABLE IF NOT EXISTS public.comprobantes_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL UNIQUE,
  botica_id uuid NOT NULL,
  token_publico varchar(96) NOT NULL UNIQUE,
  plantilla_version varchar(30) NOT NULL DEFAULT 'a4-v1',
  snapshot jsonb NOT NULL,
  hash_documento varchar(64) NOT NULL,
  emitido_at timestamptz NOT NULL DEFAULT now(),
  expira_at timestamptz NULL,
  anulado_at timestamptz NULL,
  abierto_at timestamptz NULL,
  aperturas integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comprobantes_publicos_botica ON public.comprobantes_publicos(botica_id);
