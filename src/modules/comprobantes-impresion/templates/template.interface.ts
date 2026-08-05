// src/modules/comprobantes-impresion/templates/template.interface.ts
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { ComprobantePrintData } from '../interfaces/comprobante-print-data.interface';

export interface ComprobanteTemplate {
  render(data: ComprobantePrintData): TDocumentDefinitions;
}
