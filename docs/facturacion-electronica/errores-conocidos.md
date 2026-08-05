# Errores Conocidos y Desviaciones del Plan

## Desviaciones justificadas

1. **Validación XSD local no implementada.** El plan pedía validar el XML contra
   los XSD UBL 2.1 antes de enviar. En Node.js eso exige `libxmljs2` (compilación
   nativa en Windows). Decisión: validación estructural por pruebas unitarias
   (nodos obligatorios, totales, esquemas de tributo) + validación autoritativa
   de SUNAT BETA (devuelve código y descripción exacta del error). Riesgo bajo:
   un XML inválido se rechaza con estado `RECHAZADO`/`ERROR_RESPUESTA` sin
   perder la venta. Pendiente: agregar `resources/sunat/xsd/` + validador si se
   requiere validación previa estricta.

2. **Series**: se extendió `series_documentos` en vez de crear
   `series_comprobantes` (confirmado con el usuario). El mapeo texto→catálogo 01
   vive en `correlativos.service.ts`.

3. **Boletas por `sendBill` individual** (no resumen diario) como flujo por
   defecto: es el camino más corto al primer objetivo funcional en BETA y SUNAT
   lo acepta. El resumen diario está implementado para el flujo agrupado;
   falta el interruptor en configuración para que las boletas queden
   `PENDIENTE_RESUMEN` en vez de enviarse al instante.

4. **Resumen diario manual** (sin `@nestjs/schedule`): generar/enviar/consultar
   por API. Programación automática pendiente.

5. **Emisión disparada desde el frontend tras la venta** (no dentro de
   `VentasService`): mantiene el módulo de ventas intacto; el checkout ya
   contemplaba `comprobante_estado` en la respuesta. El backend podría mover
   esta llamada al interior de la transacción de venta en una iteración futura.

## Errores encontrados y corregidos durante la implementación

| Error | Causa raíz | Corrección | Prueba |
|---|---|---|---|
| DigestValue vacío tras firmar | xml-crypto v6 no rellena `reference.digestValue` al firmar | Extraer `<ds:DigestValue>` del XML firmado | `firma.service.spec.ts` |
| CDR 2010 marcado como observación | Rango erróneo 1000–3999 | Rango oficial: 0100–1999 obs.; ≥2000 rechazo | `cdr-parser.spec.ts` |
| Mock de venta `null` ignorado | `?? ventaOk()` trata `null` como ausente | `'venta' in opts ? ...` | `comprobante-validation.spec.ts` |
| Test Nuevo RUS fallaba por tipo de serie | La validación de serie corre antes que la de régimen | Mock con serie FACTURA en ese test | mismo spec |
| `Express.Multer.File` sin tipos | Tipos multer no disponibles | Tipo estructural `{buffer, originalname, size}` | `tsc --noEmit` |
| `PdfPrinter` sin construct signature | `@types/pdfmake` solo cubre API navegador | `require` tipado del entrypoint Node | `tsc --noEmit` |
| Encoding corrupto en controladores | `Set-Content` de PowerShell 5.1 reescribe en ANSI | Reescritura con herramienta de edición UTF-8 | revisión manual + build |

## Problemas preexistentes (no de este módulo)

- 793 errores de lint en archivos ajenos (`socket-auth.service.ts`, etc.).
- 3 pruebas frontend fallan desde antes (`ComprobantePublicoPage` ×2,
  `RemoteScannerModal` ×1) — verificado con stash.
- Drift de BD (ver `base-de-datos.md`).
- Unique de `series_documentos` no incluye `botica_id` (colisión potencial
  multi-empresa con `sucursal_id` NULL). Mitigado: la reserva filtra por
  `botica_id`. Regularizar el índice requiere migración de datos.
- Frontend: 2 pruebas de `ComprobantePublicoPage` fallan por cambios previos
  ajenos a este módulo.
