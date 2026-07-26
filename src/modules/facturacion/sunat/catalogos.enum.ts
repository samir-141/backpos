// Catálogo No. 01: Código de Tipo de Documento
export enum TipoDocumentoSunat {
  FACTURA = '01',
  BOLETA = '03',
  NOTA_CREDITO = '07',
  NOTA_DEBITO = '08',
  GUIA_REMISION_REMITENTE = '09',
  COMPROBANTE_RETENCION = '20',
  COMPROBANTE_PERCEPCION = '40',
}

// Catálogo No. 06: Códigos de Tipos de Documento de Identidad
export enum TipoDocumentoIdentidad {
  DOC_TRIB_NO_DOMICILIADO = '0',
  DNI = '1',
  CARNET_EXTRANJERIA = '4',
  RUC = '6',
  PASAPORTE = '7',
  DEC_DIPLOMATICA = 'A',
}

// Catálogo No. 05: Códigos de Tipos de Tributos
export enum TipoTributo {
  IGV = '1000',
  ISC = '2000',
  EXP = '9000',
  GRA = '9001', // Gratuito
  EXO = '9002', // Exonerado
  INA = '9003', // Inafecto
  IVAP = '1016', // Arroz pilado
  ICBPER = '7152', // Bolsas plástico
  OTROS = '9999',
}

// Catálogo No. 07: Códigos de Tipo de Afectación del IGV
export enum AfectacionIgv {
  GRAVADO_OP_ONEROSO = '10',
  GRAVADO_RETIRO_POR_PREMIO = '11',
  GRAVADO_RETIRO_POR_DONACION = '12',
  GRAVADO_RETIRO = '13',
  GRAVADO_RETIRO_POR_PUBLICIDAD = '14',
  GRAVADO_BONIFICACIONES = '15',
  GRAVADO_RETIRO_POR_ENTREGA_A_TRABAJADORES = '16',
  EXONERADO_OP_ONEROSO = '20',
  EXONERADO_TRANSFERENCIA_GRATUITA = '21',
  INAFECTO_OP_ONEROSO = '30',
  INAFECTO_RETIRO_POR_BONIFICACION = '31',
  INAFECTO_RETIRO = '32',
  INAFECTO_RETIRO_POR_MUESTRAS_MEDICAS = '33',
  INAFECTO_RETIRO_POR_CONTRATO_COLECTIVO = '34',
  INAFECTO_RETIRO_POR_PREMIO = '35',
  INAFECTO_RETIRO_POR_PUBLICIDAD = '36',
  EXPORTACION = '40',
}

// Catálogo No. 09: Códigos de Tipo de Nota de Crédito Electrónica
export enum TipoNotaCredito {
  ANULACION_DE_LA_OPERACION = '01',
  ANULACION_POR_ERROR_EN_EL_RUC = '02',
  CORRECCION_POR_ERROR_EN_LA_DESCRIPCION = '03',
  DESCUENTO_GLOBAL = '04',
  DESCUENTO_POR_ITEM = '05',
  DEVOLUCION_TOTAL = '06',
  DEVOLUCION_POR_ITEM = '07',
  BONIFICACION = '08',
  DISMINUCION_EN_EL_VALOR = '09',
  OTROS_CONCEPTOS = '10',
}
