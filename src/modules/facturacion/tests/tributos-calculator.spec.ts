import { TributosCalculatorService } from '../services/tributos-calculator.service';

describe('TributosCalculatorService', () => {
  let service: TributosCalculatorService;

  beforeEach(() => {
    service = new TributosCalculatorService();
  });

  it('calcula una línea gravada con IGV incluido', () => {
    const r = service.calcular([
      {
        descripcion: 'PARACETAMOL 500MG',
        cantidad: 2,
        precioUnitarioConIgv: 10,
        afectoIgv: true,
      },
    ]);
    expect(r.totales.totalGravado).toBeCloseTo(16.95, 2);
    expect(r.totales.totalIgv).toBeCloseTo(3.05, 2);
    expect(r.totales.total).toBeCloseTo(20.0, 2);
    expect(r.items[0].codigoAfectacionIgv).toBe('10');
    expect(r.items[0].porcentajeIgv).toBe(18);
  });

  it('calcula una línea exonerada sin IGV', () => {
    const r = service.calcular([
      {
        descripcion: 'LECHE GLORIA',
        cantidad: 1,
        precioUnitarioConIgv: 5.5,
        afectoIgv: false,
      },
    ]);
    expect(r.totales.totalExonerado).toBeCloseTo(5.5, 2);
    expect(r.totales.totalGravado).toBe(0);
    expect(r.totales.totalIgv).toBe(0);
    expect(r.totales.total).toBeCloseTo(5.5, 2);
    expect(r.items[0].codigoAfectacionIgv).toBe('20');
  });

  it('aplica descuento por línea', () => {
    const r = service.calcular([
      {
        descripcion: 'PRODUCTO X',
        cantidad: 1,
        precioUnitarioConIgv: 100,
        descuento: 10,
        afectoIgv: true,
      },
    ]);
    expect(r.totales.totalDescuentos).toBeCloseTo(10, 2);
    expect(r.totales.total).toBeCloseTo(90, 2);
    expect(r.totales.totalGravado + r.totales.totalIgv).toBeCloseTo(90, 2);
  });

  it('suma varios productos mezclando gravado y exonerado', () => {
    const r = service.calcular([
      {
        descripcion: 'A',
        cantidad: 3,
        precioUnitarioConIgv: 11.8,
        afectoIgv: true,
      },
      {
        descripcion: 'B',
        cantidad: 1,
        precioUnitarioConIgv: 4.5,
        afectoIgv: false,
      },
      {
        descripcion: 'C',
        cantidad: 2,
        precioUnitarioConIgv: 0.85,
        afectoIgv: true,
      },
    ]);
    const esperado = 3 * 11.8 + 4.5 + 2 * 0.85;
    expect(r.totales.total).toBeCloseTo(esperado, 2);
    expect(r.totales.subtotal + r.totales.totalIgv).toBeCloseTo(
      r.totales.total,
      2,
    );
  });

  it('maneja cantidades decimales', () => {
    const r = service.calcular([
      {
        descripcion: 'JARABE ML',
        cantidad: 2.5,
        precioUnitarioConIgv: 10,
        afectoIgv: true,
      },
    ]);
    expect(r.totales.total).toBeCloseTo(25, 2);
  });

  it('redondea correctamente precios problemáticos', () => {
    const r = service.calcular([
      {
        descripcion: 'REDONDEO',
        cantidad: 1,
        precioUnitarioConIgv: 0.1,
        afectoIgv: true,
      },
    ]);
    expect(r.totales.total).toBeCloseTo(0.1, 2);
    expect(r.totales.totalGravado + r.totales.totalIgv).toBeCloseTo(0.1, 2);
  });

  it('genera el monto en letras', () => {
    const r = service.calcular([
      {
        descripcion: 'A',
        cantidad: 1,
        precioUnitarioConIgv: 118,
        afectoIgv: true,
      },
    ]);
    expect(r.totales.montoEnLetras).toBe('CIENTO DIECIOCHO CON 00/100 SOLES');
  });

  it('rechaza líneas sin descripción, cantidad cero o descuento excesivo', () => {
    expect(() =>
      service.calcular([
        {
          descripcion: ' ',
          cantidad: 1,
          precioUnitarioConIgv: 1,
          afectoIgv: true,
        },
      ]),
    ).toThrow('descripción');
    expect(() =>
      service.calcular([
        {
          descripcion: 'A',
          cantidad: 0,
          precioUnitarioConIgv: 1,
          afectoIgv: true,
        },
      ]),
    ).toThrow('cantidad');
    expect(() =>
      service.calcular([
        {
          descripcion: 'A',
          cantidad: 1,
          precioUnitarioConIgv: 10,
          descuento: 20,
          afectoIgv: true,
        },
      ]),
    ).toThrow('descuento');
    expect(() => service.calcular([])).toThrow('al menos un ítem');
  });
});
