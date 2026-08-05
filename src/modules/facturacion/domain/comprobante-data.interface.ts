/**
 * Estructura interna del comprobante, independiente de Prisma y del DTO HTTP.
 * Es la única fuente de datos para el generador XML, el PDF y el cálculo.
 */
export interface EmisorData {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  ubigeo?: string;
  direccion: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  codigoPais: string;
}

export interface ClienteComprobanteData {
  tipoDocumento: string; // Catálogo 06: '0','1','4','6','7'
  numeroDocumento: string;
  razonSocial: string;
  direccion?: string;
}

export interface DocumentoComprobanteData {
  tipoComprobante: string; // Catálogo 01: '01','03','07','08'
  serie: string;
  correlativo: number;
  fechaEmision: Date;
  moneda: string;
  formaPago: string;
}

export interface ComprobanteItemData {
  codigoProducto?: string;
  codigoSunat?: string;
  descripcion: string;
  unidadMedida: string; // Catálogo 03 (NIU, ZZ...)
  cantidad: number;
  valorUnitario: number; // sin IGV
  precioUnitario: number; // con IGV
  valorVenta: number; // base imponible de la línea (cantidad × valorUnitario)
  descuento: number;
  codigoAfectacionIgv: string; // Catálogo 07
  porcentajeIgv: number;
  montoIgv: number;
  importeTotal: number; // valorVenta + montoIgv
}

export interface TotalesComprobanteData {
  totalGravado: number;
  totalExonerado: number;
  totalInafecto: number;
  totalGratuito: number;
  totalDescuentos: number;
  totalIgv: number;
  subtotal: number; // suma de valor venta (base)
  total: number; // importe total a pagar
  montoEnLetras: string;
}

export interface ComprobanteSunatData {
  emisor: EmisorData;
  cliente: ClienteComprobanteData;
  documento: DocumentoComprobanteData;
  items: ComprobanteItemData[];
  totales: TotalesComprobanteData;
}

/** Nombre de archivo SUNAT: RUC-TIPO-SERIE-CORRELATIVO (sin padding). */
export function nombreArchivoComprobante(data: ComprobanteSunatData): string {
  return [
    data.emisor.ruc,
    data.documento.tipoComprobante,
    data.documento.serie,
    data.documento.correlativo,
  ].join('-');
}
