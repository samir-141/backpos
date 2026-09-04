import { todayInLima, isPreviousDayInLima } from './date-caja.utils';

describe('date-caja.utils', () => {
  it('formatea la fecha correctamente en formato YYYY-MM-DD para zona horaria America/Lima', () => {
    // 2026-09-04 12:00:00 UTC -> 2026-09-04 07:00:00 Lima
    const date = new Date('2026-09-04T12:00:00Z');
    expect(todayInLima(date)).toBe('2026-09-04');
  });

  it('detecta correctamente cuando una fecha es de un día anterior', () => {
    // Apertura ayer: 2026-09-03 20:00 Lima (2026-09-04 01:00 UTC)
    const aperturaAyer = new Date('2026-09-04T01:00:00Z'); // 2026-09-03 en Lima
    // Referencia hoy: 2026-09-04 15:00 Lima (2026-09-04 20:00 UTC)
    const hoy = new Date('2026-09-04T20:00:00Z'); // 2026-09-04 en Lima

    expect(isPreviousDayInLima(aperturaAyer, hoy)).toBe(true);
  });

  it('detecta correctamente cuando una fecha es del mismo día', () => {
    // Apertura hoy 08:00 Lima (13:00 UTC)
    const aperturaHoy = new Date('2026-09-04T13:00:00Z');
    // Consulta hoy 18:00 Lima (23:00 UTC)
    const hoyTarde = new Date('2026-09-04T23:00:00Z');

    expect(isPreviousDayInLima(aperturaHoy, hoyTarde)).toBe(false);
  });
});
