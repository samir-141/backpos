# Configuración — Facturación Electrónica

## Variables de entorno (backend `.env`)

| Variable | Descripción |
|---|---|
| `ENCRYPTION_KEY` | **Obligatoria.** 64 hex (32 bytes). Generar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SUNAT_ENVIRONMENT` | `BETA` (por defecto) o `PRODUCCION` |
| `SUNAT_BETA_ENDPOINT` | Por defecto `https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService` |
| `SUNAT_PROD_ENDPOINT` | Por defecto `https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService` |
| `SUNAT_SOAP_TIMEOUT_MS` | Timeout SOAP (defecto 30000) |
| `COMPROBANTES_STORAGE_DIR` | Raíz de artefactos (defecto `./storage`) |

Sin `ENCRYPTION_KEY` el guardado de credenciales y la firma lanzan error explícito.

## Configuración por empresa (UI o API)

UI: `Administración → Facturación`. API:

```
GET/POST/PATCH  /api/facturacion/configuracion-tributaria
POST            /api/facturacion/configuracion-tributaria/certificado   (multipart: certificado + clave)
POST            /api/facturacion/configuracion-tributaria/probar-conexion
```

Campos: RUC (11), razón social, nombre comercial, ubigeo, dirección fiscal,
régimen (`GENERAL` | `MYPE` | `RER` | `NUEVO_RUS`), ambiente, usuario/clave SOL,
certificado .pfx/.p12 (máx. 5 MB) con su contraseña.

**Nunca** se devuelven secretos: solo `tiene_credenciales_sol` / `tiene_certificado`.
Dejar los campos de credenciales en blanco conserva los valores cifrados.

## Series

CRUD existente: `Administración → Series` (`/api/series-documentos`).
Tipos: BOLETA, FACTURA, NOTA_VENTA, NOTA_CREDITO, NOTA_DEBITO, GUIA_REMISION.
El correlativo lo asigna solo el backend al emitir; no editarlo tras emitir.

## Instalación del certificado (paso a paso)

1. Guardar la configuración tributaria (RUC real, dirección fiscal, régimen).
2. En "Certificado digital", seleccionar el `.pfx`/`.p12` y escribir su contraseña.
3. El backend valida que el certificado abra con la clave y registra su vencimiento.
4. "Verificar configuración" debe responder `{ listo: true }`.
