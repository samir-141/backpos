import { DocumentTypeOption } from '../interfaces/tax-rule-strategy.interface';

export class TaxEvaluationResultDto {
  perfilTributarioId: string;
  ruc: string;
  razonSocial: string;
  regimen: string;
  sistemaEmision: string;
  ambiente: string;
  total: number;

  allowedDocumentTypes: DocumentTypeOption[];
  documentRequired: boolean; // Obligatorio si total >= 5.00 o si cliente lo solicita
  customerDocumentRequired: boolean; // Obligatorio si total > 700.00 o si cliente lo solicita o es Factura
  requiresValidRuc: boolean; // Obligatorio para Factura (01)
  canConsolidateDaily: boolean; // True si total < 5.00 y no se emite comprobante individual

  valid: boolean;
  errors: string[];
  warnings: string[];
}
