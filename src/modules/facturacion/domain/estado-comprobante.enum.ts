/** Estados del ciclo de vida de un comprobante electrónico SUNAT. */
export enum EstadoComprobante {
  PENDIENTE = 'PENDIENTE',
  GENERANDO_XML = 'GENERANDO_XML',
  XML_GENERADO = 'XML_GENERADO',
  FIRMADO = 'FIRMADO',
  COMPRIMIDO = 'COMPRIMIDO',
  ENVIANDO = 'ENVIANDO',
  ACEPTADO = 'ACEPTADO',
  ACEPTADO_CON_OBSERVACIONES = 'ACEPTADO_CON_OBSERVACIONES',
  RECHAZADO = 'RECHAZADO',
  ERROR_ENVIO = 'ERROR_ENVIO',
  ERROR_RESPUESTA = 'ERROR_RESPUESTA',
  ERROR_LOCAL = 'ERROR_LOCAL',
  PENDIENTE_RESUMEN = 'PENDIENTE_RESUMEN',
  EN_RESUMEN = 'EN_RESUMEN',
  ANULADO = 'ANULADO',
}

/** Estados desde los que se permite reintentar el envío. */
export const ESTADOS_REINTENTABLES: ReadonlySet<string> = new Set([
  EstadoComprobante.PENDIENTE,
  EstadoComprobante.ERROR_ENVIO,
  EstadoComprobante.ERROR_RESPUESTA,
  EstadoComprobante.ERROR_LOCAL,
  EstadoComprobante.XML_GENERADO,
  EstadoComprobante.FIRMADO,
  EstadoComprobante.COMPRIMIDO,
]);
