export interface SunatSolCredenciales {
  ruc?: string;
  dni?: string;
  usuario?: string;
  clave: string;
  modoAcceso?: 'DNI' | 'RUC';
}

export interface SunatSolReceptor {
  tipoDoc: '1' | '4' | '7' | '0' | string; // 1: DNI, 4: Carnet de extranjeria, 7: Pasaporte, 0: Doc Trib No Dom / Sin doc
  numeroDoc?: string;
  razonSocialODatos?: string;
  direccion?: string;
  email?: string;
}

export interface SunatSolItem {
  tipo: 'BIEN' | 'SERVICIO';
  codigo?: string;
  descripcion: string;
  cantidad: number;
  unidadMedida?: string; // 'NIU', 'ZZ', etc.
  precioUnitario: number; // Precio con IGV o total
  tipoAfectacionIgv?: 'GRAVADO' | 'EXONERADO' | 'INAFECTO';
}

export interface EmitirBoletaSolParams {
  boticaId: string;
  credenciales: SunatSolCredenciales;
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
  serie?: string;             // Ej: EB01
  correlativo?: number;       // Ej: 123
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
