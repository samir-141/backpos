import { Injectable } from '@nestjs/common';

@Injectable()
export class PdfGeneratorService {
  async generarPdf(datos: any, tipo: 'A4' | 'TICKET'): Promise<Buffer> {
    // Lógica para generar PDF con pdfmake y qrcode
    return Buffer.from('');
  }
}
