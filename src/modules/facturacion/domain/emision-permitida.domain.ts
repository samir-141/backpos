import { TipoDocumentoSunat } from '../sunat/catalogos.enum';
import { RegimenTributario } from './ambiente-sunat.enum';

/**
 * Matriz de emisión por régimen tributario (qué comprobantes SUNAT puede
 * emitir la empresa según su régimen).
 *
 * - NUEVO_RUS: solo boletas de venta (03). No emite facturas.
 * - RER / MYPE / GENERAL: facturas, boletas y notas asociadas.
 * - Sin configuración o régimen desconocido: ningún comprobante electrónico
 *   (el POS solo puede usar nota de venta interna, que no es documento SUNAT).
 */
const PERMISOS_POR_REGIMEN: Record<string, readonly string[]> = {
  [RegimenTributario.NUEVO_RUS]: [TipoDocumentoSunat.BOLETA],
  [RegimenTributario.RER]: [
    TipoDocumentoSunat.FACTURA,
    TipoDocumentoSunat.BOLETA,
    TipoDocumentoSunat.NOTA_CREDITO,
    TipoDocumentoSunat.NOTA_DEBITO,
  ],
  [RegimenTributario.MYPE]: [
    TipoDocumentoSunat.FACTURA,
    TipoDocumentoSunat.BOLETA,
    TipoDocumentoSunat.NOTA_CREDITO,
    TipoDocumentoSunat.NOTA_DEBITO,
  ],
  [RegimenTributario.GENERAL]: [
    TipoDocumentoSunat.FACTURA,
    TipoDocumentoSunat.BOLETA,
    TipoDocumentoSunat.NOTA_CREDITO,
    TipoDocumentoSunat.NOTA_DEBITO,
  ],
};

const NOMBRES_TIPO: Record<string, string> = {
  [TipoDocumentoSunat.FACTURA]: 'facturas',
  [TipoDocumentoSunat.BOLETA]: 'boletas',
  [TipoDocumentoSunat.NOTA_CREDITO]: 'notas de crédito',
  [TipoDocumentoSunat.NOTA_DEBITO]: 'notas de débito',
};

const NOMBRES_REGIMEN: Record<string, string> = {
  [RegimenTributario.NUEVO_RUS]: 'Nuevo RUS',
  [RegimenTributario.RER]: 'RER',
  [RegimenTributario.MYPE]: 'Régimen MYPE',
  [RegimenTributario.GENERAL]: 'Régimen General',
};

/** Tipos de comprobante SUNAT (catálogo 01) permitidos para el régimen. */
export function comprobantesPermitidos(
  regimen: string | null | undefined,
): string[] {
  if (!regimen) return [];
  return [...(PERMISOS_POR_REGIMEN[regimen] ?? [])];
}

/** ¿El régimen permite emitir este tipo de comprobante? */
export function puedeEmitir(
  regimen: string | null | undefined,
  tipoComprobante: string,
): boolean {
  return comprobantesPermitidos(regimen).includes(tipoComprobante);
}

/**
 * Motivo legible del bloqueo o `null` si está permitido.
 * Mantiene el mensaje histórico del Nuevo RUS.
 */
export function motivoBloqueoEmision(
  regimen: string | null | undefined,
  tipoComprobante: string,
): string | null {
  if (puedeEmitir(regimen, tipoComprobante)) return null;
  if (
    regimen === (RegimenTributario.NUEVO_RUS as string) &&
    tipoComprobante === (TipoDocumentoSunat.FACTURA as string)
  ) {
    return 'Una empresa en Nuevo RUS no puede emitir facturas';
  }
  const nombreRegimen =
    NOMBRES_REGIMEN[regimen ?? ''] ??
    (regimen ? `desconocido (${regimen})` : '');
  const nombreTipo =
    NOMBRES_TIPO[tipoComprobante] ?? `el documento ${tipoComprobante}`;
  const permitidos = comprobantesPermitidos(regimen)
    .map((t) => NOMBRES_TIPO[t] ?? t)
    .join(', ');
  if (permitidos) {
    return `El régimen ${nombreRegimen} no permite emitir ${nombreTipo}. Permitidos: ${permitidos}`;
  }
  if (regimen) {
    return `El régimen ${nombreRegimen} no permite emitir comprobantes electrónicos`;
  }
  return 'Sin configuración tributaria válida no se pueden emitir comprobantes electrónicos';
}

/**
 * Coherencia RUC ↔ régimen. Devuelve el motivo del error o `null` si es válido.
 * - El Nuevo RUS solo aplica a personas naturales con negocio (RUC inicia en 10).
 */
export function errorCoherenciaRucRegimen(
  ruc: string,
  regimen: string,
): string | null {
  if (!/^\d{11}$/.test(ruc)) {
    return 'El RUC debe tener 11 dígitos';
  }
  if (
    regimen === (RegimenTributario.NUEVO_RUS as string) &&
    !ruc.startsWith('10')
  ) {
    return 'El Nuevo RUS solo aplica a RUC de persona natural (inicia en 10)';
  }
  return null;
}
