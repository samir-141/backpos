/**
 * Convierte un importe numérico a su representación en letras (español, PEN).
 * Ejemplo: 118.5 → "CIENTO DIECIOCHO CON 50/100 SOLES"
 */
const UNIDADES = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISEIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
];

const DECENAS = [
  '',
  '',
  'VEINTI',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

function seccion(num: number): string {
  if (num === 0) return '';
  if (num === 100) return 'CIEN';
  const c = Math.floor(num / 100);
  const resto = num % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto > 0) {
    if (resto <= 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (d === 2 && u > 0) {
        partes.push(`VEINTI${UNIDADES[u]}`);
      } else if (u > 0) {
        partes.push(`${DECENAS[d]} Y ${UNIDADES[u]}`);
      } else {
        partes.push(DECENAS[d]);
      }
    }
  }
  return partes.join(' ');
}

function millares(num: number): string {
  if (num === 0) return 'CERO';
  const partes: string[] = [];
  const millones = Math.floor(num / 1_000_000);
  const miles = Math.floor((num % 1_000_000) / 1000);
  const resto = num % 1000;
  if (millones > 0) {
    partes.push(
      millones === 1 ? 'UN MILLON' : `${millares(millones)} MILLONES`,
    );
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${millares(miles)} MIL`);
  }
  if (resto > 0) partes.push(seccion(resto));
  return partes.join(' ');
}

export function numeroALetras(importe: number, moneda = 'SOLES'): string {
  const redondeado = Math.round(importe * 100);
  const entero = Math.floor(redondeado / 100);
  const centimos = redondeado % 100;
  const letras = millares(entero);
  const cc = centimos.toString().padStart(2, '0');
  return `${letras} CON ${cc}/100 ${moneda}`;
}
