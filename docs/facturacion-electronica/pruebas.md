# Pruebas

## Backend (`posBackend/pos-backend`)

```bash
npm run test          # unitarias (jest, ts-jest)
npm run test:e2e      # e2e (app real con Prisma mockeado)
npm run build         # nest build (swc)
npx tsc --noEmit -p tsconfig.build.json   # chequeo de tipos estricto
npm run lint          # eslint 9
```

Cobertura del módulo (`src/modules/facturacion/tests/`):

| Suite | Casos |
|---|---|
| `tributos-calculator.spec.ts` | gravado, exonerado, descuento, redondeo, varios ítems, cantidades decimales, monto en letras, entradas inválidas |
| `comprobante-validation.spec.ts` | 12 casos: venta inexistente/anulada/otra sucursal, duplicado, serie inactiva/tipo erróneo, sin config, certificado vencido, Nuevo RUS, RUC en factura, DNI en boleta ≥700, sin ítems |
| `correlativos.service.spec.ts` | incremento, serie inexistente, serie inactiva |
| `xml-builder.spec.ts` | nodos UBL obligatorios, emisor real, monto en letras, totales, esquema EXO |
| `firma.service.spec.ts` | extracción .p12, clave incorrecta, firma insertada en ExtensionContent, digest |
| `zip.service.spec.ts` | nombre único, contenido, ZIP corrupto |
| `cdr-parser.spec.ts` | aceptado, observaciones, rechazo, ZIP corrupto, XML vacío, sin Response/ResponseCode |
| `numero-a-letras.spec.ts` | conversiones y redondeo |
| `encryption.service.spec.ts` | roundtrip AES-GCM, IV único, sin clave, payload manipulado |
| `resumen-diario-xml.spec.ts` | SummaryDocuments UBL 2.0/1.1 |

Resultado actual: **172/172 unitarias OK** (36 suites) y **6/6 e2e OK**.

Nota: la prueba de concurrencia real de correlativos (dos cajas simultáneas)
requiere BD viva; la atomicidad se garantiza por `UPDATE ... RETURNING`
(bloqueo de fila) y el unique `(botica_id, tipo, serie, correlativo)` como
red de seguridad. Pendiente prueba de integración con BD de pruebas.

## Frontend (`PosFrontend`)

```bash
npm run test   # vitest
npm run lint   # oxlint
npm run build  # tsc -b && vite build
```

`CheckoutModal.test.tsx` actualizado al nuevo flujo (mock de
`facturacionService.emitir`). Resultado: 71/74 OK; los 3 fallos son
preexistentes y ajenos al módulo.

## Pruebas contra SUNAT BETA

Requieren certificado y credenciales del usuario. Procedimiento en
`ambiente-beta.md`. Estado: **pendiente de credenciales**.
