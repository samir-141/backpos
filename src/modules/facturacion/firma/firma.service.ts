import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SignedXml } from 'xml-crypto';
import * as forge from 'node-forge';

export interface CertificadoExtraido {
  privateKeyPem: string;
  certPem: string;
  /** Certificado en base64 puro (sin cabeceras PEM), para X509Certificate. */
  certBase64: string;
  fechaVencimiento: Date;
  titular: string;
}

export interface ResultadoFirma {
  xmlFirmado: string;
  /** DigestValue del documento: es el "hash" que SUNAT muestra en sus portales. */
  digestValue: string;
}

const XPATH_RAIZ =
  "//*[local-name(.)='Invoice' or local-name(.)='CreditNote' or local-name(.)='DebitNote' or local-name(.)='SummaryDocuments' or local-name(.)='VoidedDocuments']";
const XPATH_EXTENSION = "//*[local-name(.)='ExtensionContent']";

/** Firma digital XMLDSig de comprobantes SUNAT (RSA-SHA1, enveloped). */
@Injectable()
export class FirmaService {
  private readonly logger = new Logger(FirmaService.name);

  /** Extrae llave privada y certificado de un archivo .p12/.pfx. */
  extraerCertificado(p12: Buffer, password: string): CertificadoExtraido {
    try {
      const der = forge.util.createBuffer(p12.toString('binary'));
      const asn1 = forge.asn1.fromDer(der);
      const p12Obj = forge.pkcs12.pkcs12FromAsn1(asn1, password);

      const keyBags = p12Obj.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
      })[forge.pki.oids.pkcs8ShroudedKeyBag];
      const certBags = p12Obj.getBags({
        bagType: forge.pki.oids.certBag,
      })[forge.pki.oids.certBag];

      const key = keyBags?.[0]?.key;
      const cert = certBags?.[0]?.cert;
      if (!key || !cert) {
        throw new BadRequestException(
          'El certificado no contiene llave privada y certificado público',
        );
      }

      const certPem = forge.pki.certificateToPem(cert);
      const campoCn = cert.subject.getField('CN') as
        { value?: string } | null | undefined;
      return {
        privateKeyPem: forge.pki.privateKeyToPem(key),
        certPem,
        certBase64: certPem
          .replace(/-----BEGIN CERTIFICATE-----/g, '')
          .replace(/-----END CERTIFICATE-----/g, '')
          .replace(/\r?\n/g, ''),
        fechaVencimiento: cert.validity.notAfter,
        titular: campoCn?.value ?? '',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `No se pudo leer el certificado: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        'No se pudo leer el certificado digital (¿contraseña incorrecta?)',
      );
    }
  }

  /** Firma el XML e inserta el nodo ds:Signature en ext:ExtensionContent. */
  firmarXml(
    xml: string,
    privateKeyPem: string,
    certBase64: string,
  ): ResultadoFirma {
    try {
      const sig = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certBase64,
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        canonicalizationAlgorithm:
          'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        getKeyInfoContent: (args) => {
          const cert = args?.publicCert;
          const certTexto = typeof cert === 'string' ? cert : '';
          return `<X509Data><X509Certificate>${certTexto}</X509Certificate></X509Data>`;
        },
      });

      sig.addReference({
        xpath: XPATH_RAIZ,
        transforms: [
          'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
          'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        ],
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
        isEmptyUri: false,
      });

      sig.computeSignature(xml, {
        prefix: 'ds',
        location: { reference: XPATH_EXTENSION, action: 'append' },
        attrs: { Id: 'SignatureSP' },
      });

      const xmlFirmado = sig.getSignedXml();
      // xml-crypto no expone el digest en la referencia tras firmar:
      // se extrae del propio XML firmado.
      const coincidencia =
        /<(?:\w+:)?DigestValue>([^<]+)<\/(?:\w+:)?DigestValue>/.exec(
          xmlFirmado,
        );
      const digestValue = coincidencia?.[1]?.trim() ?? '';
      if (!digestValue) {
        throw new Error('No se pudo obtener el DigestValue de la firma');
      }

      return { xmlFirmado, digestValue };
    } catch (error) {
      this.logger.error(`Error al firmar XML: ${(error as Error).message}`);
      throw new InternalServerErrorException(
        'No se pudo firmar el XML del comprobante',
      );
    }
  }
}
