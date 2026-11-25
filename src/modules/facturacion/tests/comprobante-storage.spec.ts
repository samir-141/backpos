/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import {
  LocalFileStorageProvider,
  ComprobanteStorageService,
} from '../storage/comprobante-storage.service';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';

describe('LocalFileStorageProvider & ComprobanteStorageService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('LocalFileStorageProvider (Serverless resilience)', () => {
    it('debe seleccionar os.tmpdir() si se detecta entorno serverless como Vercel o AWS Lambda', () => {
      delete process.env.COMPROBANTES_STORAGE_DIR;
      process.env.VERCEL = '1';

      const provider = new LocalFileStorageProvider();
      expect((provider as any).root).toContain(os.tmpdir());
    });

    it('debe respetar COMPROBANTES_STORAGE_DIR si está explícitamente configurada', () => {
      process.env.COMPROBANTES_STORAGE_DIR = '/custom/persistent/storage';
      const provider = new LocalFileStorageProvider();
      expect((provider as any).root).toBe(
        path.resolve('/custom/persistent/storage'),
      );
    });

    it('debe realizar fallback automático a os.tmpdir() si ocurre EROFS en save()', async () => {
      delete process.env.VERCEL;
      delete process.env.COMPROBANTES_STORAGE_DIR;

      const provider = new LocalFileStorageProvider();
      const relativePath = 'empresas/20123456789/2026/11/comprobante.xml';
      const contenido = Buffer.from('<xml>test</xml>');

      let callCount = 0;
      jest.spyOn(fs, 'mkdir').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const erofsError = new Error(
            "EROFS: read-only file system, mkdir '/var/task/storage'",
          );
          (erofsError as any).code = 'EROFS';
          throw erofsError;
        }
        return undefined;
      });

      const writeFileSpy = jest
        .spyOn(fs, 'writeFile')
        .mockResolvedValue(undefined);

      const savedPath = await provider.save(relativePath, contenido);
      expect(savedPath).toBe(relativePath);
      expect((provider as any).root).toContain(os.tmpdir());
      expect(writeFileSpy).toHaveBeenCalled();
    });

    it('debe prevenir Directory Traversal fuera de la raíz de almacenamiento', () => {
      const provider = new LocalFileStorageProvider();
      expect(() => {
        (provider as any).resolver('../../../etc/passwd');
      }).toThrow('Ruta de almacenamiento inválida');
    });
  });

  describe('ComprobanteStorageService', () => {
    it('debe estructurar correctamente la ruta relativa por empresa/año/mes', () => {
      const provider = new LocalFileStorageProvider();
      const service = new ComprobanteStorageService(provider);
      const fecha = new Date(2026, 10, 25); // Noviembre 2026

      const dir = service.directorioComprobante(
        '20600000001',
        fecha,
        'B001-00000123',
      );
      expect(dir).toBe('empresas/20600000001/2026/11/B001-00000123');
    });
  });
});
