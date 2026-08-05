import { numeroALetras } from '../utils/numero-a-letras.util';

describe('numeroALetras', () => {
  it.each([
    [0, 'CERO CON 00/100 SOLES'],
    [1, 'UNO CON 00/100 SOLES'],
    [16, 'DIECISEIS CON 00/100 SOLES'],
    [21, 'VEINTIUNO CON 00/100 SOLES'],
    [100, 'CIEN CON 00/100 SOLES'],
    [118, 'CIENTO DIECIOCHO CON 00/100 SOLES'],
    [1050.5, 'MIL CINCUENTA CON 50/100 SOLES'],
    [2000000, 'DOS MILLONES CON 00/100 SOLES'],
  ])('convierte %s correctamente', (monto, esperado) => {
    expect(numeroALetras(monto)).toBe(esperado);
  });

  it('redondea céntimos', () => {
    expect(numeroALetras(10.999)).toBe('ONCE CON 00/100 SOLES');
  });
});
