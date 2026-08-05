import { ConflictException, GoneException } from '@nestjs/common';
import {
  ComprobantesPublicosService,
  hashSnapshot,
} from './comprobantes-publicos.service';

describe('ComprobantesPublicosService integridad', () => {
  const snapshot = { total: 20, cliente: { nombre: 'Cliente' } };

  function setup(overrides: Record<string, unknown> = {}) {
    const comprobante = {
      id: 'comprobante-1',
      botica_id: 'botica-1',
      token_publico: 'token',
      plantilla_version: 'a4-v1',
      snapshot,
      hash_documento: hashSnapshot(snapshot),
      anulado_at: null,
      expira_at: null,
      ...overrides,
    };
    const prisma = {
      comprobantes_publicos: {
        findUnique: jest.fn().mockResolvedValue(comprobante),
        update: jest.fn().mockResolvedValue(comprobante),
      },
    } as any;
    const audit = { registrar: jest.fn().mockResolvedValue(undefined) } as any;
    return {
      service: new ComprobantesPublicosService(prisma, audit),
      prisma,
      audit,
    };
  }

  it('rechaza 409, audita y nunca sobrescribe un hash diferente', async () => {
    const { service, prisma, audit } = setup({
      hash_documento: '0'.repeat(64),
    });
    await expect(service.obtener('token')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'COMPROBANTE_INTEGRIDAD_FALLIDA' }),
    );
    expect(prisma.comprobantes_publicos.update).not.toHaveBeenCalled();
  });

  it('conserva la versión y registra apertura cuando el hash coincide', async () => {
    const { service, prisma, audit } = setup();
    await expect(service.obtener('token')).resolves.toMatchObject({
      plantilla_version: 'a4-v1',
      hash_documento: hashSnapshot(snapshot),
    });
    expect(prisma.comprobantes_publicos.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ aperturas: { increment: 1 } }),
      }),
    );
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('mantiene 410 para un enlace expirado', async () => {
    const { service } = setup({ expira_at: new Date(Date.now() - 1_000) });
    await expect(service.obtener('token')).rejects.toBeInstanceOf(
      GoneException,
    );
  });
});
