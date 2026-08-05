# Base de Datos — Facturación Electrónica

Migración: `prisma/migrations/20260803210000_add_facturacion_electronica/migration.sql`
(aplicada con `prisma migrate deploy` el 2026-08-03 en la BD de desarrollo).

## Tablas creadas (6)

| Tabla | Propósito | Claves |
|---|---|---|
| `configuraciones_tributarias` | Emisor por empresa: RUC, dirección fiscal, régimen, ambiente, SOL cifrado, certificado | `uq_config_tributarias_botica` (1:1 con empresa) |
| `comprobantes_electronicos` | Cabecera + fotografía tributaria + estado SUNAT + rutas de archivos | `uq_..._numero` (botica+tipo+serie+correlativo), `uq_..._venta_tipo` |
| `comprobantes_electronicos_detalles` | Líneas tributarias históricas | FK cascade al comprobante |
| `comprobantes_intentos_envio` | Auditoría de cada envío (sin credenciales) | unique (comprobante, numero_intento) |
| `resumenes_diarios` | RC de boletas con ticket SUNAT | unique (botica, fecha, correlativo) |
| `resumenes_diarios_detalles` | Boletas incluidas en cada resumen | unique (resumen, comprobante) |

Autorrelación `ComprobanteReferencia` en `comprobantes_electronicos` para NC/ND.

## Tabla reutilizada

`series_documentos` (ya existía): fuente única de series/correlativos.
`correlativo_actual` = **siguiente número disponible**; la reserva es atómica:

```sql
UPDATE series_documentos
SET correlativo_actual = correlativo_actual + 1
WHERE id = $1 AND botica_id = $2 AND activo = true
RETURNING serie, correlativo_actual - 1;
```

## Pendiente conocido (drift preexistente)

La BD de desarrollo tiene drift respecto al historial de migraciones
(`metodos_pago` unique, FKs de `productos_comerciales`, índices
`idx_detalles_compras_lote_id`, `idx_productos_tipo_producto`, etc.).
Por eso la migración se generó manualmente con solo los objetos nuevos.
`prisma migrate dev` seguirá pidiendo reset hasta regularizar ese drift
(tarea independiente de este módulo).

## RLS

Las tablas nuevas siguen la convención del proyecto; agregar sus políticas a
`prisma/rls_policies.sql` antes de producción (como el resto de tablas tenant).

## Seed

`npm run db:seed-fe` → `prisma/seed-facturacion-electronica.js` (idempotente).
Crea series B001/F001/BC01/FC01 para la empresa y sucursal principal.
Los catálogos SUNAT viven como enums en `sunat/catalogos.enum.ts` (no hay
tablas catálogo en esta BD).
