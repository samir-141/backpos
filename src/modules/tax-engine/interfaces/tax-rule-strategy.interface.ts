export interface CustomerTaxData {
  tipoDoc?: string | null; // 1=DNI, 6=RUC, 4=CE, 0=SIN_DOC
  numeroDoc?: string | null;
  denominacion?: string | null;
  direccion?: string | null;
  solicitaComprobante?: boolean;
  solicitaIdentificacion?: boolean;
}

export interface DocumentTypeOption {
  tipo: string; // 01=Factura, 03=Boleta, 12=Ticket POS, NOTA_VENTA, SIN_COMPROBANTE
  descripcion: string;
  serieSugerida?: string;
  habilitado: boolean;
  motivoBloqueo?: string;
}

export interface TaxRuleContext {
  regimen: string; // NRUS, NUEVO_RUS, RMT, MYPE, RER, GENERAL
  sistemaEmision: string; // SEE_CF, SEE_CONTRIBUYENTE, SEE_SOL, PSE, OSE, MANUAL
  total: number;
  tipoDocumentoSeleccionado?: string;
  cliente?: CustomerTaxData;
}

export interface TaxRuleEvaluation {
  allowedDocumentTypes: DocumentTypeOption[];
  documentRequired: boolean;
  customerDocumentRequired: boolean;
  requiresValidRuc: boolean;
  canConsolidateDaily: boolean;
  errors: string[];
}

export interface TaxRuleStrategy {
  supports(regimen: string): boolean;
  evaluate(context: TaxRuleContext): TaxRuleEvaluation;
}
