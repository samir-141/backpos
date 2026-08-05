// src/modules/comprobantes-impresion/interfaces/comprobante-print-data.interface.ts
import { ComprobanteSunatData } from '../../facturacion/domain/comprobante-data.interface';

export interface ComprobantePagoData {
  monto: number;
  metodoPago: string;
  referencia?: string;
}

export interface ComprobantePrintData extends ComprobanteSunatData {
  sucursalNombre: string;
  sucursalDireccion?: string;
  pagos: ComprobantePagoData[];
  montoRecibido?: number;
  vuelto?: number;
  hash?: string;
  qrCode?: string;
  estado?: string;
}
