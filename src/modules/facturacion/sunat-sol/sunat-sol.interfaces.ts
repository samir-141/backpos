export interface SunatSolCredenciales {
  ruc?: string;
  dni?: string;
  usuario?: string;
  clave: string;
  modoAcceso?: 'DNI' | 'RUC';
}

export interface SunatSolReceptor {
  tipoDoc: '1' | '6' | '4' | '7' | '0' | string; // 1: DNI, 6: RUC, 4: Carnet de extranjería, 7: Pasaporte, 0: Doc Trib No Dom / Sin doc
  numeroDoc?: string;
  razonSocialODatos?: string;
  direccion?: string;
  email?: string;
}

export interface SunatSolItem {
  tipo: 'BIEN' | 'SERVICIO';
  codigo?: string;
  /**
   * Descripción del bien (producto) o servicio vendido (ej: "AGUA CIELO 500ML", "AMOXICILINA 500MG").
   * Se transfiere directamente al campo [id="item.descripcion"] en el portal SUNAT SOL.
   */
  descripcion: string;
  cantidad: number;
  unidadMedida?: string; // 'NIU' para bienes/unidades, 'ZZ' para servicios
  precioUnitario: number; // Precio unitario final de venta (con IGV incluido)
  tipoAfectacionIgv?: 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
}

export interface EmitirBoletaSolParams {
  boticaId: string;
  credenciales: SunatSolCredenciales;
  tipoComprobante?: 'BOLETA' | 'FACTURA';
  fechaEmision?: Date;
  moneda?: 'PEN' | 'USD';
  receptor: SunatSolReceptor;
  items: SunatSolItem[];
  observaciones?: string;
  timeoutMs?: number;
  headless?: boolean;
}

export interface ResultadoBoletaSol {
  exito: boolean;
  numeroComprobante?: string; // Ej: EB01-00000123
  serie?: string; // Ej: EB01
  correlativo?: number; // Ej: 123
  fechaEmision?: string;
  montoTotal?: number;
  pdfBuffer?: Buffer;
  pdfBase64?: string;
  screenshotBase64?: string;
  mensajeRespuesta?: string;
  codigoError?: string;
  duracionMs?: number;
}

export interface TestConexionSolResult {
  exito: boolean;
  ruc?: string;
  dni?: string;
  usuario?: string;
  razonSocialDetectada?: string;
  mensaje: string;
  capturaBase64?: string;
}
