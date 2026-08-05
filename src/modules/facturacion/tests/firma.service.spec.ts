import * as forge from 'node-forge';
import { FirmaService } from '../firma/firma.service';

/** Genera un certificado autofirmado de prueba en formato .p12. */
export function generarP12DePrueba(password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [{ name: 'commonName', value: 'CERTIFICADO DE PRUEBA' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: '3des',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

describe('FirmaService', () => {
  let service: FirmaService;
  const password = 'clave-prueba';
  let p12: Buffer;

  beforeAll(() => {
    service = new FirmaService();
    p12 = generarP12DePrueba(password);
  });

  it('extrae llave privada y certificado de un .p12', () => {
    const cert = service.extraerCertificado(p12, password);
    expect(cert.privateKeyPem).toContain('BEGIN');
    expect(cert.certBase64.length).toBeGreaterThan(100);
    expect(cert.titular).toBe('CERTIFICADO DE PRUEBA');
    expect(cert.fechaVencimiento.getTime()).toBeGreaterThan(Date.now());
  });

  it('rechaza contraseña incorrecta del certificado', () => {
    expect(() => service.extraerCertificado(p12, 'malisima')).toThrow();
  });

  it('firma el XML insertando ds:Signature en ext:ExtensionContent', () => {
    const cert = service.extraerCertificado(p12, password);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>
  <ID xmlns="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">B001-1</ID>
</Invoice>`;
    const { xmlFirmado, digestValue } = service.firmarXml(
      xml,
      cert.privateKeyPem,
      cert.certBase64,
    );

    expect(xmlFirmado).toContain('ds:Signature');
    expect(xmlFirmado).toContain('Id="SignatureSP"');
    expect(xmlFirmado).toContain('DigestValue');
    expect(xmlFirmado).toContain('X509Certificate');
    expect(digestValue.length).toBeGreaterThan(10);

    // La firma queda dentro de ExtensionContent
    const idxExtension = xmlFirmado.indexOf('ExtensionContent');
    const idxFirma = xmlFirmado.indexOf('ds:Signature');
    expect(idxFirma).toBeGreaterThan(idxExtension);
  });
});
