# Despliegue

## Pasos

```bash
# 1. Backend
npx prisma migrate deploy        # aplica 20260803210000_add_facturacion_electronica
npx prisma generate
npm run build
# 2. Variables: ENCRYPTION_KEY (obligatoria), SUNAT_*, COMPROBANTES_STORAGE_DIR
# 3. Seed de series (idempotente)
npm run db:seed-fe
# 4. Frontend
npm run build
```

Verificación post-despliegue: `npx prisma migrate status` → "up to date";
`GET /api/facturacion/configuracion-tributaria` responde 200/401 según auth.

## Rollback

Ver `rollback.md`.
