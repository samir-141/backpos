# Flujo de Emisión y Estados

## Emisión desde el POS

1. El cajero cierra la venta (`POST /api/ventas`) — la venta se registra con su
   snapshot público como siempre (no cambia).
2. Si eligió **Boleta** o **Factura**, el frontend llama
   `POST /api/facturacion/emitir { ventaId, tipoComprobante, serieId }`.
3. Backend (transacción): valida (17 reglas), reserva correlativo atómico,
   recalcula tributos en céntimos, crea comprobante + detalles (estado `PENDIENTE`).
4. Backend (fuera de la transacción): XML UBL 2.1 → firma digital → ZIP →
   SOAP `sendBill` → CDR → actualización de estado → PDF.
5. El cajero ve el resultado. Si SUNAT falló, la venta está registrada y el
   comprobante queda reintentable (botón **Reintentar** en el historial).

## Reglas de negocio clave

- Factura (01): exige cliente con RUC de 11 dígitos.
- Boleta (03) de S/ 700.00 o más: exige DNI o CE.
- El frontend no puede enviar totales, correlativos ni datos del emisor.
- Reintento: mismo comprobante, mismo XML/ZIP; solo estados
  `PENDIENTE`, `ERROR_ENVIO`, `ERROR_RESPUESTA`, `ERROR_LOCAL`, intermedios.
- Un comprobante `ACEPTADO` nunca se reenvía ni se elimina.

## Matriz de emisión por RUC/régimen (`domain/emision-permitida.domain.ts`)

| Régimen | Puede emitir |
|---|---|
| NUEVO_RUS (solo RUC 10 — persona natural) | Boletas (03) |
| RER | Facturas, boletas, NC, ND (01/03/07/08) |
| MYPE | 01/03/07/08 |
| GENERAL | 01/03/07/08 |
| Sin configuración / régimen desconocido | Ningún comprobante electrónico (solo nota de venta interna) |

- La API expone `comprobantes_permitidos` en la configuración tributaria;
  el POS bloquea las opciones no permitidas mostrando el motivo.
- Al guardar la configuración se valida la coherencia RUC↔régimen
  (Nuevo RUS exige RUC que inicia en 10).
- La nota de venta no es documento SUNAT: siempre disponible.

## Máquina de estados

```
PENDIENTE → ENVIANDO → ACEPTADO
                     → ACEPTADO_CON_OBSERVACIONES
                     → RECHAZADO
                     → ERROR_ENVIO / ERROR_RESPUESTA / ERROR_LOCAL → (reintento)
PENDIENTE_RESUMEN → EN_RESUMEN → ACEPTADO/RECHAZADO (vía resumen diario)
ANULADO (vía nota de crédito — pendiente)
```

Código SUNAT: `0` aceptado; `0100–1999` aceptado con observaciones; `≥2000` rechazado.

## Endpoints de comprobantes

```
POST /api/facturacion/emitir
GET  /api/facturacion/comprobantes?estado=&tipo=&pagina=&limite=
GET  /api/facturacion/comprobantes/:id
POST /api/facturacion/comprobantes/:id/enviar
POST /api/facturacion/comprobantes/:id/reintentar
GET  /api/facturacion/comprobantes/:id/xml     (XML firmado)
GET  /api/facturacion/comprobantes/:id/cdr     (XML de la CDR)
GET  /api/facturacion/comprobantes/:id/pdf     (representación impresa)
```

## Resumen diario (boletas agrupadas)

```
GET  /api/facturacion/resumenes-diarios
POST /api/facturacion/resumenes-diarios/generar    { fechaReferencia }
POST /api/facturacion/resumenes-diarios/:id/enviar
POST /api/facturacion/resumenes-diarios/:id/consultar
```

Toma boletas en `PENDIENTE_RESUMEN` de la fecha, genera `RC-YYYYMMDD-###`,
firma, `sendSummary` (ticket) y `getStatus` hasta la CDR; luego actualiza las
boletas incluidas. Proceso manual por ahora (sin scheduler).
