export enum AmbienteSunat {
  BETA = 'BETA',
  PRODUCCION = 'PRODUCCION',
}

export enum FormaPago {
  CONTADO = 'CONTADO',
  CREDITO = 'CREDITO',
}

export enum RegimenTributario {
  NUEVO_RUS = 'NUEVO_RUS',
  NRUS = 'NRUS',
  RER = 'RER',
  MYPE = 'MYPE',
  RMT = 'RMT',
  GENERAL = 'GENERAL',
  OTRO = 'OTRO',
}

export enum SistemaEmision {
  SEE_SOL = 'SEE_SOL',
  SEE_CONTRIBUYENTE = 'SEE_CONTRIBUYENTE',
  SEE_CF = 'SEE_CF',
  FACTURADOR_SUNAT = 'FACTURADOR_SUNAT',
  PSE = 'PSE',
  OSE = 'OSE',
  MANUAL = 'MANUAL',
}

export enum TipoContribuyente {
  PERSONA_NATURAL = 'PERSONA_NATURAL',
  PERSONA_JURIDICA = 'PERSONA_JURIDICA',
}

/** Catálogo No. 03 SUNAT / UN-ECE (subset usado por el POS). */
export enum UnidadMedidaSunat {
  UNIDAD = 'NIU',
  SERVICIO = 'ZZ',
}
