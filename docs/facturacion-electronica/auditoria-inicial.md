# Auditoría Inicial — Facturación Electrónica SUNAT

Fecha: 2026-08-03
Alcance: `posBackend/pos-backend` (NestJS 11 + Prisma 7 + PostgreSQL/Supabase) y `PosFrontend` (React 19 + Vite).

---

## 1. Hallazgo principal: ya existe un esqueleto de facturación

**No se partirá de cero.** El backend ya contiene `src/modules/facturacion/` (~25% implementado) y tablas/módulos relacionados. La estrategia será **extender lo existente**, no duplicarlo.

### Estado del módulo `src/modules/facturacion/`

| Archivo | Estado | Acción |
|---|---|---|
| `facturacion.module.ts` | Completo (providers registrados) | Extender con nuevos servicios |
| `controllers/facturacion.controller.ts` | `POST /facturacion/emitir` **sin guards ni DTO** (`payload: any`) | Proteger con `AuthGuard('jwt') + TenantGuard`, usar DTO real |
| `services/facturacion.service.ts` | Stub orquestador (solo valida + genera XML, no persiste) | Implementar pipeline completo |
| `builders/xml-builder.service.ts` | UBL 2.1 Invoice funcional pero **emisor quemado** (RUC 20000000001 "FARMACIA DEMO S.A.C.") | Parametrizar emisor desde configuración tributaria; agregar `cbc:Note` monto en letras; CreditNote es stub |
| `firma/firma.service.ts` | Stub (devuelve XML sin firmar) | Implementar con `xml-crypto` (ya instalado) |
| `sunat/sunat-soap.service.ts` | Stub mock (acepta todo) | Implementar SOAP real con `axios` (lib `soap` no instalada; se evaluará) |
| `pdf/pdf-generator.service.ts` | Stub (Buffer vacío) | Implementar con `pdfmake` + `qrcode` (ya instalados) |
| `validators/facturacion.validator.ts` | Funcional (Factura exige RUC; Boleta ≥ S/700 exige DNI) | Reutilizar y ampliar |
| `dtos/create-invoice.dto.ts` | Completo con class-validator | Reutilizar (estructura interna); crear DTO de emisión por `ventaId` |
| `sunat/catalogos.enum.ts` | Catálogos SUNAT 01/05/06/07/09 completos | Reutilizar como enums de dominio |

---

## 2. Tablas existentes relevantes (prisma/schema.prisma, 28 modelos)

| Tabla física | Modelo Prisma | Relevancia para FE |
|---|---|---|
| `empresas` | `boticas` (con `@@map`) | Tenant. Tiene `ruc`, `razon_social`, `direccion`, `configuracion Json?`. **Sin ubigeo ni datos fiscales SUNAT completos** |
| `sucursales` | `sucursales` (`botica_id` mapea a columna `empresa_id`) | Establecimiento. Sin ubigeo ni código de establecimiento |
| `clientes` | `clientes` | `tipo_documento` es **string libre** ("DNI"), SUNAT exige catálogo 06 ('1','6'). Ya tiene `condicion_contribuyente`, `estado_sunat` |
| `ventas` | `ventas` | `estado` EMITIDO/ANULADO, `idempotency_key`, totales Decimal(15,2). **NO persiste tipo_comprobante/serie/correlativo** (solo en snapshot JSON) |
| `detalles_ventas` | `detalles_ventas` | Líneas con `precio_unitario_presentacion`, `descuento`, `subtotal`, lote FEFO |
| `pagos` / `metodos_pago` | — | Métodos EFECTIVO/TARJETA/YAPE_PLIN/TRANSFERENCIA |
| `cajas` | `cajas` | Venta exige caja ABIERTA |
| **`series_documentos`** | `series_documentos` | ⚠️ **YA EXISTE**: `botica_id`, `tipo_documento`, `serie`, `correlativo_inicial`, `correlativo_actual`, `longitud_correlativo`, `sucursal_id?`, `activo`. Sin `deleted_at` (borrado físico). Unique `(serie, tipo_documento, sucursal_id)` **no incluye botica_id**. Correlativo editable por PATCH (no atómico) |
| **`comprobantes_publicos`** | `comprobantes_publicos` | ⚠️ **YA EXISTE**: snapshot público de venta con token, hash SHA-256. NO es comprobante electrónico SUNAT |
| `medicamentos` | `medicamentos` | `afecto_igv Boolean` — único flag tributario de producto |
| `unidades_presentacion` | — | `abreviatura` libre; no hay código UNECE SUNAT ("NIU") |
| `migracion_log` | — | Usada como log de auditoría por `AuditService` |

### Tablas a crear (nuevas, sin colisión de nombres)

- `configuraciones_tributarias` (1:1 con empresa; RUC, dirección fiscal, ubigeo, régimen, ambiente, SOL cifrado, certificado).
- `comprobantes_electronicos` (cabecera con XML/CDR paths, hash, estado SUNAT, totales; unique `(botica_id, tipo, serie, correlativo)`; referencia a venta y a comprobante de referencia para NC/ND).
- `comprobantes_electronicos_detalles` (fotografía histórica tributaria por línea).
- `comprobantes_intentos_envio` (auditoría de envíos/reintentos).
- `resumenes_diarios` + `resumenes_diarios_detalles`.
- Decisión pendiente: **extender `series_documentos`** (agregar tipos 07/08, `deleted_at`, correlativo atómico) en vez de crear `series_comprobantes` nueva → **recomendado extender la existente** para no duplicar gestión (el frontend ya la administra).

---

## 3. Funciones/servicios reutilizables

| Existente | Ubicación | Uso en FE |
|---|---|---|
| `AuditService` (global) | `src/modules/audit/audit.service.ts` | Registrar `COMPROBANTE_EMITIDO/RECHAZADO/REINTENTO` |
| `TenantGuard` + `req.botica_id` | `src/auth/guards/tenant.guard.ts` | Contexto empresa en todos los endpoints FE |
| `RolesGuard` + `@Roles()` | `src/auth/` | Proteger endpoints de configuración tributaria |
| Cálculo en centavos (`toCents`/`fromCents`) | `src/modules/ventas/ventas.service.ts` | Base para `tributos-calculator.service.ts` (IGV 18%, `afecto_igv`) |
| `hashSnapshot()` SHA-256 | `src/modules/comprobantes-publicos/comprobantes-publicos.service.ts` | Patrón de hash de documento |
| Idempotencia por `idempotency_key` | `ventas.service.ts` | Patrón a replicar en emisión (doble clic) |
| Catálogos SUNAT enums | `src/modules/facturacion/sunat/catalogos.enum.ts` | Dominio FE |
| Validador de comprobante | `src/modules/facturacion/validators/facturacion.validator.ts` | Validación previa a emisión |
| Series CRUD | `src/modules/series-documentos/` | Extender con reserva atómica de correlativo |

## 4. Lo que NO existe (a crear)

- Servicio de cifrado (AES-256-GCM) → `src/common/security/encryption.service.ts` + variable `ENCRYPTION_KEY`.
- Servicio de almacenamiento de archivos → `storage/` con interfaz `FileStorageProvider` (local primero, S3 después).
- Cliente SOAP real a SUNAT (hay `axios`; falta decidir lib `soap` vs SOAP manual).
- Parser de CDR (hay `fast-xml-parser` instalado).
- Lectura de certificado .p12/.pfx → **falta dependencia** (`node-forge` recomendado).
- Monto en letras → falta dependencia o utilidad propia.
- Scheduler/colas para resumen diario → `@nestjs/schedule` (no instalado; la generación inicial será manual).
- Tests del módulo `facturacion` (cero actualmente).

---

## 5. Frontend (PosFrontend)

| Existente | Estado | Acción |
|---|---|---|
| Checkout (`CheckoutModal.tsx`) | BOLETA/FACTURA/NOTA_VENTA con validaciones SUNAT (RUC, boleta ≥ S/700) | Conectar con emisión real; bloquear FACTURA si régimen Nuevo RUS |
| `VentaRegistradaResponse` (`src/types/dto.ts:99`) | Ya contempla `comprobante`, `comprobante_estado`, `comprobante_url` | Mapear a respuesta real del backend |
| `SeriesDocumentosAdmin.tsx` | CRUD funcional de series | Agregar tipos NC/ND; quitar edición manual de correlativo tras emisión |
| `FacturacionAdmin.tsx` | Panel sandbox con payload quemado | Reemplazar por configuración tributaria real (RUC, SOL, certificado, probar conexión) |
| `comprobanteDocument.ts` | Genera "XML UBL" en cliente con RUC quemado (mock) | Eliminar/reemplazar por artefactos del backend |
| `ReporteComprobantes.tsx` | Historial con serie/correlativo/estado **simulados** | Conectar a `comprobantes_electronicos` reales |
| Impresión | 58/80mm/A4 vía CSS print | Integrar PDF del backend como opción |
| HTTP | axios con Bearer + `x-sucursal-id`, react-query, toast PrimeReact | Reutilizar patrones |

---

## 6. Riesgos detectados

1. **Alto — Endpoint `/api/facturacion/emitir` sin autenticación** ni tenant hoy. Debe protegerse antes de cualquier lógica real.
2. **Alto — Correlativos no atómicos**: `series_documentos.correlativo_actual` editable por PATCH; riesgo de duplicados con dos cajas concurrentes. Requiere `UPDATE ... RETURNING` o `SELECT FOR UPDATE`.
3. **Alto — Unique de series sin `botica_id`**: `(serie, tipo_documento, sucursal_id)` con `sucursal_id` NULL colisiona entre empresas distintas.
4. **Medio — Cambios sin commitear** en ambos repos (main). La rama `feature/facturacion-electronica-sunat` heredará esos cambios; no se hará commit sin autorización del usuario.
5. **Medio — Emisor quemado** en `XmlBuilderService` y en el mock del frontend.
6. **Medio — Prisma 7 con cliente generado en `src/generated/prisma`**: cada cambio de schema exige `prisma generate`; hay elementos manuales (RLS, índices parciales, vistas) que no migra Prisma solo.
7. **Medio — Mapeo de catálogos**: `clientes.tipo_documento` ("DNI") → catálogo 06; `medicamentos.afecto_igv` (boolean) → catálogo 07; unidades → catálogo 03 ("NIU").
8. **Bajo — `AuditService` persiste en `migracion_log`** (tabla compartida); aceptable por ahora.
9. **Bajo — Módulos legados duplicados** `src/products/`, `src/users/` fuera de `src/modules/`; no tocarlos.

## 7. Dependencias necesarias (backend)

Ya instaladas y suficientes: `xmlbuilder2`, `xml-crypto`, `fast-xml-parser`, `adm-zip`, `pdfmake`, `qrcode`, `axios`.

A agregar:
- `node-forge` (lectura .p12/.pfx, extracción de clave privada y cadena).
- `@nestjs/schedule` (opcional en fase de resumen diario; inicio manual).
- Utilidad monto-en-letras (implementación propia simple, sin dependencia, para PEN).

No se instalará `soap` inicialmente: SOAP envelope manual con `axios` (menos dependencias, mismo resultado para `sendBill`/`sendSummary`/`getStatus`).

## 8. Archivos que serán modificados

- `prisma/schema.prisma` (nuevos modelos + extensión de `series_documentos`).
- `src/modules/facturacion/**` (todos los stubs → implementación real).
- `src/modules/series-documentos/` (reserva atómica de correlativo).
- `src/modules/ventas/ventas.service.ts` (hook post-venta para emisión opcional; sin romper flujo actual).
- `src/app.module.ts` (ya importa FacturacionModule; verificar nuevos providers).
- `.env.example` (nuevas variables SUNAT/cifrado).
- `.gitignore` (certificados, storage, .env).
- Frontend: `FacturacionAdmin.tsx`, `SeriesDocumentosAdmin.tsx`, `CheckoutModal.tsx`, `ReporteComprobantes.tsx`, `services/`.

## 9. Archivos nuevos principales

- `src/common/security/encryption.service.ts`
- `src/modules/facturacion/` (subcarpetas: `storage/`, `cdr/`, `zip/`, `reintentos/`, `domain/`, `tests/`)
- `prisma/seed/facturacion-electronica.seed.*`
- `docs/facturacion-electronica/*` (esta carpeta)

## 10. Posibles conflictos

- Nombre `series_comprobantes` del plan vs tabla existente `series_documentos` → se extiende la existente.
- `ventas` sin columnas de comprobante → la tabla `comprobantes_electronicos` será hija de `ventas` (no se toca `ventas` salvo necesidad).
- `comprobantes_publicos` (snapshot público) coexistirá con `comprobantes_electronicos`; responsabilidades distintas (difusión vs tributario).

## 11. Bloqueos que requieren decisión del usuario

1. **Base de datos destino de la migración**: ¿el `.env` actual apunta a una BD de desarrollo/descartable o a la principal de Supabase? El plan exige aplicar primero en base de pruebas.
2. **Rama git**: hay cambios extensos sin commitear en ambos repos; la rama los heredará. ¿Se procede así?
3. **Certificado y credenciales SOL BETA**: no están en el repo (correcto). La fase de envío real a SUNAT BETA los requerirá del usuario.
