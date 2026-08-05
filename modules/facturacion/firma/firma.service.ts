import { Injectable } from '@nestjs/common';

@Injectable()
export class FirmaService {
  firmarXml(
    xmlString: string,
    certBase64: string,
    certPassword: string,
  ): string {
    // Lógica para firmar el XML usando xml-crypto y el certificado p12
    return xmlString; // Retornar XML firmado
  }
}
