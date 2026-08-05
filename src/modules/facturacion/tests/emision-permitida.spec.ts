import {
  comprobantesPermitidos,
  puedeEmitir,
  motivoBloqueoEmision,
  errorCoherenciaRucRegimen,
} from '../domain/emision-permitida.domain';

describe('Emisión permitida por régimen y RUC', () => {
  describe('comprobantesPermitidos', () => {
    it('Nuevo RUS solo emite boletas', () => {
      expect(comprobantesPermitidos('NUEVO_RUS')).toEqual(['03']);
    });

    it.each(['RER', 'MYPE', 'GENERAL'])(
      '%s emite factura, boleta y notas',
      (regimen) => {
        expect(comprobantesPermitidos(regimen)).toEqual([
          '01',
          '03',
          '07',
          '08',
        ]);
      },
    );

    it('régimen desconocido o ausente no emite nada', () => {
      expect(comprobantesPermitidos('OTRO')).toEqual([]);
      expect(comprobantesPermitidos(null)).toEqual([]);
      expect(comprobantesPermitidos(undefined)).toEqual([]);
    });
  });

  describe('puedeEmitir', () => {
    it('Nuevo RUS: boleta sí, factura no', () => {
      expect(puedeEmitir('NUEVO_RUS', '03')).toBe(true);
      expect(puedeEmitir('NUEVO_RUS', '01')).toBe(false);
    });

    it('GENERAL permite todo', () => {
      ['01', '03', '07', '08'].forEach((t) =>
        expect(puedeEmitir('GENERAL', t)).toBe(true),
      );
    });
  });

  describe('motivoBloqueoEmision', () => {
    it('devuelve null cuando está permitido', () => {
      expect(motivoBloqueoEmision('GENERAL', '01')).toBeNull();
      expect(motivoBloqueoEmision('NUEVO_RUS', '03')).toBeNull();
    });

    it('mantiene el mensaje histórico del Nuevo RUS con factura', () => {
      expect(motivoBloqueoEmision('NUEVO_RUS', '01')).toBe(
        'Una empresa en Nuevo RUS no puede emitir facturas',
      );
    });

    it('explica el bloqueo con los tipos permitidos', () => {
      const motivo = motivoBloqueoEmision('NUEVO_RUS', '07');
      expect(motivo).toContain('Nuevo RUS');
      expect(motivo).toContain('boletas');
    });

    it('sin configuración válida no permite comprobantes', () => {
      expect(motivoBloqueoEmision(null, '03')).toContain(
        'Sin configuración tributaria',
      );
    });
  });

  describe('errorCoherenciaRucRegimen', () => {
    it('rechaza RUC mal formado', () => {
      expect(errorCoherenciaRucRegimen('123', 'GENERAL')).toContain(
        '11 dígitos',
      );
    });

    it('Nuevo RUS exige RUC de persona natural (10)', () => {
      expect(errorCoherenciaRucRegimen('10445678901', 'NUEVO_RUS')).toBeNull();
      expect(errorCoherenciaRucRegimen('20123456789', 'NUEVO_RUS')).toContain(
        'persona natural',
      );
    });

    it('otros regímenes aceptan RUC 10 o 20', () => {
      expect(errorCoherenciaRucRegimen('20123456789', 'GENERAL')).toBeNull();
      expect(errorCoherenciaRucRegimen('10445678901', 'RER')).toBeNull();
    });
  });
});
