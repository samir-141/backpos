// src/common/validators/documento.validator.ts
// Validadores centralizados de documentos de identidad peruanos.

/**
 * Valida un RUC peruano de 11 dígitos incluyendo su dígito verificador (módulo 11).
 * Prefijos admitidos según SUNAT: 10, 15, 16, 17 y 20.
 */
export function isValidPeruvianRuc(ruc: string): boolean {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + Number(ruc[index]) * weight,
    0,
  );
  const remainder = 11 - (sum % 11);
  const verifier = remainder === 10 ? 0 : remainder === 11 ? 1 : remainder;
  return verifier === Number(ruc[10]);
}

/**
 * Valida un DNI peruano de 8 dígitos. DNI no posee dígito verificador,
 * solo se comprueba el formato numérico.
 */
export function isValidDni(dni: string): boolean {
  return /^[0-9]{8}$/.test(dni);
}
