export interface EmissionResult {
  exito: boolean;
  estado: string; // ACCEPTED, REJECTED, PENDING, MANUAL, OFFLINE_PENDING
  codigo_respuesta?: string;
  mensaje_respuesta?: string;
  xml_path?: string;
  xml_firmado_path?: string;
  zip_path?: string;
  cdr_zip_path?: string;
  cdr_xml_path?: string;
  hash?: string;
  ticket_sunat?: string;
  observaciones?: any;
}

export interface EmissionContext {
  boticaId: string;
  perfilTributario: any;
  comprobante: any;
}

export interface IEmissionProvider {
  readonly nombre: string;
  emitir(ctx: EmissionContext): Promise<EmissionResult>;
}
