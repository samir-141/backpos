# Arquitectura — Facturación Electrónica SUNAT

## Flujo general

```
React POS (CheckoutModal)
    ↓ POST /ventas  (la venta SIEMPRE se registra primero)
    ↓ POST /api/facturacion/emitir { ventaId, tipoComprobante, serieId }
NestJS → FacturacionService
    ↓ ComprobanteValidationService (17 validaciones)
    ↓ Transacción Prisma: CorrelativosService (UPDATE atómico) + snapshot
    ↓ XmlBuilderService (UBL 2.1)
    ↓ FirmaService (xml-crypto + node-forge, certificado .p12 del servidor)
    ↓ ZipService (adm-zip)
    ↓ SunatSoapClient (axios, sobre SOAP manual + WSSE)
    ↓ SUNAT BETA/PRODUCCIÓN
    ↓ CdrParserService (fast-xml-parser)
    ↓ BD (estado, hash, rutas) + storage/ (XML, ZIP, CDR, PDF)
```

El frontend **nunca** se comunica con SUNAT ni conoce credenciales/certificados.

## Decisiones de diseño

1. **Se extendió el módulo `src/modules/facturacion/` existente** (no se creó uno nuevo). Los stubs (firma, SOAP, PDF) fueron reemplazados por implementaciones reales.
2. **Series**: se reutiliza la tabla `series_documentos` (ya gestionada en el frontend). Mapeo en `correlativos.service.ts`: BOLETA→03, FACTURA→01, NOTA_CREDITO→07, NOTA_DEBITO→08. El correlativo se reserva con `UPDATE ... RETURNING` (bloqueo de fila, sin duplicados bajo concurrencia).
3. **Snapshot tributario**: `comprobantes_electronicos` + `_detalles` guardan la fotografía histórica (si el producto cambia después, el comprobante no).
4. **Idempotencia**: unique `(botica_id, tipo_comprobante, serie, correlativo)` y `(venta_id, tipo_comprobante)`. El reintento reutiliza XML/ZIP ya generados; jamás se genera un correlativo nuevo para reenviar.
5. **La venta no depende de SUNAT**: si SUNAT cae, la venta queda COMPLETADA y el comprobante en `ERROR_ENVIO`/`ERROR_RESPUESTA` (reintentable).
6. **Cifrado**: AES-256-GCM (`EncryptionService`, clave `ENCRYPTION_KEY`) para usuario/clave SOL y contraseña del certificado. La API solo expone indicadores (`tiene_credenciales_sol`, `tiene_certificado`).
7. **Storage local** con interfaz `FileStorageProvider` (sustituible por S3). Ruta: `storage/empresas/{ruc}/{año}/{mes}/{ruc-tipo-serie-correlativo}/`.
8. **Boletas**: se envían individualmente por `sendBill` (válido en BETA y aceptado por SUNAT). El resumen diario (RC) está implementado como mecanismo adicional (`ResumenDiarioService`) para el flujo agrupado y anulaciones.

## Estructura del módulo

```
src/modules/facturacion/
├── builders/xml-builder.service.ts          # UBL 2.1 boleta/factura
├── builders/resumen-diario-xml.builder.ts   # SummaryDocuments (RC)
├── cdr/cdr-parser.service.ts
├── controllers/ (facturacion, configuracion-tributaria, resumen-diario)
├── domain/ (estados, ambiente, interfaces de datos)
├── dtos/ (emitir-comprobante, configuracion-tributaria)
├── firma/firma.service.ts
├── mappers/venta-to-comprobante.mapper.ts
├── pdf/pdf-generator.service.ts             # A4 y ticket 80 mm + QR
├── services/ (facturacion, configuracion-tributaria, correlativos,
│              tributos-calculator, comprobante-validation, resumen-diario)
├── storage/comprobante-storage.service.ts
├── sunat/ (catalogos.enum, sunat-soap.client)
├── tests/ (10 suites, 56 pruebas)
├── utils/numero-a-letras.util.ts
└── zip/zip.service.ts
src/common/security/encryption.service.ts
```
