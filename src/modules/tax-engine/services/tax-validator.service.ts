import { Injectable } from '@nestjs/common';

@Injectable()
export class TaxValidatorService {
  validarRuc(ruc: string): boolean {
    if (!ruc || typeof ruc !== 'string') return false;
    const clean = ruc.trim();
    if (!/^\d{11}$/.test(clean)) return false;

    // Check valid prefix (10, 15, 17, 20)
    const prefix = clean.substring(0, 2);
    if (!['10', '15', '17', '20'].includes(prefix)) return false;

    // SUNAT Modulo 11 check
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(clean.charAt(i), 10) * weights[i];
    }
    const remainder = sum % 11;
    let checkDigit = 11 - remainder;
    if (checkDigit === 10) checkDigit = 0;
    if (checkDigit === 11) checkDigit = 1;

    return checkDigit === parseInt(clean.charAt(10), 10);
  }

  validarDni(dni: string): boolean {
    if (!dni || typeof dni !== 'string') return false;
    return /^\d{8}$/.test(dni.trim());
  }

  validarCe(ce: string): boolean {
    if (!ce || typeof ce !== 'string') return false;
    return /^[a-zA-Z0-9]{4,12}$/.test(ce.trim());
  }
}
