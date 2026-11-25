/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { NotFoundException } from '@nestjs/common';
import { ComprobantesImpresionService } from './comprobantes-impresion.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ComprobantesImpresionService (Serverless & Memory Dual-Store)', () => {
  let service: ComprobantesImpresionService;
  let mockPrisma: Partial<PrismaService>;

  beforeEach(() => {
    mockPrisma = {
      ventas: {
        findFirst: jest.fn(),
        count: jest.fn(),
      } as any,
      boticas: {
        findFirst: jest.fn(),
      } as any,
      comprobantes_electronicos: {
        findFirst: jest.fn(),
      } as any,
      comprobantes_publicos: {
        findFirst: jest.fn(),
        create: jest.fn(),
      } as any,
    };

    service = new ComprobantesImpresionService(mockPrisma as PrismaService);
  });

  describe('onModuleInit', () => {
    it('debe inicializar el directorio temporal sin errores en condiciones normales', () => {
      expect(() => service.onModuleInit()).not.toThrow();
      expect(fs.existsSync((service as any).tempDir)).toBe(true);
    });

    it('no debe romper la aplicación si la creación de directorio temporal falla', () => {
      // Simular ruta inválida para forzar error en mkdirSync
      (service as any).tempDir = path.join(
        os.tmpdir(),
        'pos-farmacia\0invalid-dir',
      );

      // Validar que captura la excepción internamente y no la propaga, evitando la caída del backend
      expect(() => service.onModuleInit()).not.toThrow();
    });
  });

  describe('obtenerArchivoTemporal y seguridad', () => {
    it('debe rechazar intentos de Path Traversal con NotFoundException', async () => {
      await expect(
        service.obtenerArchivoTemporal('../../etc/passwd.pdf'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.obtenerArchivoTemporal('..\\..\\windows\\system32\\cmd.exe'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.obtenerArchivoTemporal('malicioso.sh'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe servir archivos almacenados en memoria caché de forma inmediata', async () => {
      const dummyFilename = '11111111-2222-3333-4444-555555555555.pdf';
      const dummyBuffer = Buffer.from('%PDF-1.4 test dummy pdf content');

      // Inyectar en memoria caché simulando generación previa
      (service as any).memoryStore.set(dummyFilename, {
        buffer: dummyBuffer,
        expiresAt: Date.now() + 60000,
      });

      const resultado = await service.obtenerArchivoTemporal(dummyFilename);
      expect(resultado).toEqual(dummyBuffer);
    });

    it('debe descartar elementos expirados de la memoria caché y lanzar NotFoundException', async () => {
      const dummyFilename = '22222222-3333-4444-5555-666666666666.pdf';
      const dummyBuffer = Buffer.from('%PDF-1.4 expired');

      // Inyectar con tiempo expirado
      (service as any).memoryStore.set(dummyFilename, {
        buffer: dummyBuffer,
        expiresAt: Date.now() - 1000,
      });

      // No existe en disco tampoco
      jest
        .spyOn(fs.promises, 'readFile')
        .mockRejectedValue(new Error('ENOENT'));

      await expect(
        service.obtenerArchivoTemporal(dummyFilename),
      ).rejects.toThrow(NotFoundException);

      expect((service as any).memoryStore.has(dummyFilename)).toBe(false);
    });

    it('debe leer desde disco si no está en memoria pero existe físicamente', async () => {
      const dummyFilename = '33333333-4444-5555-6666-777777777777.pdf';
      const diskBuffer = Buffer.from('%PDF-1.4 from disk');

      const readFileSpy = jest
        .spyOn(fs.promises, 'readFile')
        .mockResolvedValue(diskBuffer);

      const resultado = await service.obtenerArchivoTemporal(dummyFilename);
      expect(resultado).toEqual(diskBuffer);
      expect(readFileSpy).toHaveBeenCalledWith(
        path.join((service as any).tempDir, dummyFilename),
      );

      readFileSpy.mockRestore();
    });
  });

  describe('limpieza de memoria', () => {
    it('debe respetar el límite máximo de elementos en memoria (MAX_CACHE_ITEMS)', () => {
      const max = (service as any).MAX_CACHE_ITEMS;
      for (let i = 0; i < max + 50; i++) {
        (service as any).memoryStore.set(`doc-${i}.pdf`, {
          buffer: Buffer.from(`item-${i}`),
          expiresAt: Date.now() + 100000,
        });
      }

      (service as any).limpiarMemoriaExpirada();
      expect((service as any).memoryStore.size).toBeLessThanOrEqual(max);
    });
  });
});
