# Ambiente SUNAT BETA

## Requisitos

1. Configuración tributaria con el RUC de pruebas (p. ej. `20000000001`) o el RUC real.
2. Credenciales SOL. En BETA, SUNAT acepta el usuario genérico:
   - Usuario: `MODDATOS` — Clave: `moddatos` (válido solo con RUC `20000000001`).
   - Con RUC real, crear usuario secundario en SUNAT SOL con perfil "Facturador Electrónico".
3. Certificado digital. Para BETA se acepta un certificado autofirmado cuyo
   titular (CN) contenga el RUC usado. Generar uno de pruebas:

```bash
node -e "
const forge = require('node-forge');
const k = forge.pki.rsa.generateKeyPair(2048);
const c = forge.pki.createCertificate();
c.publicKey = k.publicKey; c.serialNumber = '01';
c.validity.notBefore = new Date();
c.validity.notAfter = new Date(Date.now() + 365*86400000);
const a = [{ name: 'commonName', value: '20000000001 PRUEBA' }];
c.setSubject(a); c.setIssuer(a);
c.sign(k.privateKey, forge.md.sha256.create());
const p12 = forge.pkcs12.toPkcs12Asn1(k.privateKey, [c], 'clave123', { algorithm: '3des' });
require('fs').writeFileSync('cert-prueba.p12', Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));
console.log('cert-prueba.p12 generado (clave: clave123)');
"
```

(Subirlo por la UI; el archivo nunca entra al repositorio — está en `.gitignore`.)

## Prueba manual del pipeline completo

1. `npm run db:seed` y `npm run db:seed-fe` (si la BD está vacía).
2. Configurar empresa (RUC `20000000001`, dirección, régimen GENERAL, ambiente BETA,
   SOL `MODDATOS`/`moddatos`, certificado de prueba).
3. Registrar una venta en el POS con boleta.
4. Verificar en `storage/empresas/20000000001/.../` los archivos
   `original.xml`, `firmado.xml`, `comprobante.zip`, `cdr.zip`, `cdr.xml`, `comprobante.pdf`.
5. El estado esperado es `ACEPTADO` con código `0` en la CDR.

## Casos de prueba sugeridos en BETA

- Boleta 1 ítem / varios ítems / con descuento / exonerada.
- Boleta ≥ S/ 700 con DNI (obligatorio).
- Credenciales incorrectas → `ERROR_RESPUESTA` y reintento.
- Doble clic en cobrar → un solo comprobante (idempotencia de venta + comprobante).
- Factura con empresa en Nuevo RUS → rechazo local sin llamar a SUNAT.

## Paso a producción (posterior)

1. Cambiar `ambiente` a `PRODUCCION` en la configuración tributaria.
2. Subir el certificado digital real (firmado por entidad acreditada).
3. Usar credenciales SOL reales de la empresa.
4. Revisar `SUNAT_PROD_ENDPOINT`.
5. Definir el flujo de boletas: individual (sendBill) o resumen diario programado.
