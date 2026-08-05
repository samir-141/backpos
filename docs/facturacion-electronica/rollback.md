# Rollback

## Código

Ambos repos trabajan en la rama `feature/facturacion-electronica-sunat`.
Volver a `main` revierte todo el módulo (los cambios son aditivos; los únicos
archivos previos modificados fueron los stubs de `src/modules/facturacion/`
y puntos puntuales del frontend).

## Base de datos

La migración `20260803210000_add_facturacion_electronica` solo crea objetos
nuevos (no altera tablas existentes). Revertir con:

```sql
DROP TABLE IF EXISTS resumenes_diarios_detalles;
DROP TABLE IF EXISTS resumenes_diarios;
DROP TABLE IF EXISTS comprobantes_intentos_envio;
DROP TABLE IF EXISTS comprobantes_electronicos_detalles;
DROP TABLE IF EXISTS comprobantes_electronicos;
DROP TABLE IF EXISTS configuraciones_tributarias;
DELETE FROM _prisma_migrations
WHERE migration_name = '20260803210000_add_facturacion_electronica';
```

⚠️ Esto elimina el historial de comprobantes electrónicos; exportar antes si ya
hubo emisiones reales.

## Respaldo previo

Estructura completa de la BD antes de la migración:
`POS_Farmacia/backups/schema_backup_pre_fe_20260803_205404.sql`
(34 CREATE TABLE, generado con `prisma migrate diff`).

## Artefactos

`storage/` (XML, ZIP, CDR, PDF) no se toca en un rollback de código.
Las series creadas por `db:seed-fe` (B001/F001/BC01/FC01) pueden borrarse
desde la UI de Series si no se usaron.
