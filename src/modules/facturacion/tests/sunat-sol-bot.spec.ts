import { Test, TestingModule } from '@nestjs/testing';
import { SunatSolBotService } from '../sunat-sol/sunat-sol-bot.service';
import { SunatSolEmissionProvider } from '../sunat-sol/sunat-sol-emission.provider';
import { ComprobanteStorageService } from '../storage/comprobante-storage.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('SunatSolBotService & SunatSolEmissionProvider', () => {
  let botService: SunatSolBotService;
  let provider: SunatSolEmissionProvider;

  const mockStorageService = {
    directorioComprobante: jest
      .fn()
      .mockReturnValue('empresas/20123456789/2026/09/03-EB01-100'),
    guardarPdf: jest
      .fn()
      .mockResolvedValue(
        'empresas/20123456789/2026/09/03-EB01-100/comprobante.pdf',
      ),
  };

  const mockEncryptionService = {
    encrypt: jest.fn().mockReturnValue('encrypted_text'),
    decrypt: jest.fn().mockReturnValue('decrypted_text'),
  };

  const mockPrismaService = {
    perfiles_tributarios: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'perfil-1',
        botica_id: 'botica-123',
        ruc: '20123456789',
        configuracion_emision: {
          sol_usuario_encriptado: 'enc_user',
          sol_clave_encriptada: 'enc_pass',
          ambiente: 'BETA',
        },
      }),
    },
    configuraciones_tributarias: {
      findUnique: jest.fn().mockResolvedValue({
        botica_id: 'botica-123',
        ruc: '20123456789',
        sol_usuario_encriptado: 'enc_user',
        sol_clave_encriptada: 'enc_pass',
        ambiente: 'BETA',
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SunatSolBotService,
        SunatSolEmissionProvider,
        { provide: ComprobanteStorageService, useValue: mockStorageService },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    botService = module.get<SunatSolBotService>(SunatSolBotService);
    provider = module.get<SunatSolEmissionProvider>(SunatSolEmissionProvider);
  });

  it('debe estar definido el servicio de bot y el proveedor', () => {
    expect(botService).toBeDefined();
    expect(provider).toBeDefined();
    expect(provider.nombre).toBe('SUNAT_SOL_BOT');
  });

  it('debe emitir boleta exitosamente a través de SunatSolEmissionProvider', async () => {
    const spyEmitir = jest
      .spyOn(botService, 'emitirBoletaSol')
      .mockResolvedValue({
        exito: true,
        numeroComprobante: 'EB01-00000100',
        serie: 'EB01',
        correlativo: 100,
        mensajeRespuesta: 'Aceptado por SUNAT SEE-SOL',
        pdfBuffer: Buffer.from('%PDF-1.4 test'),
        duracionMs: 1500,
      });

    const ctx = {
      boticaId: 'botica-123',
      perfilTributario: {},
      comprobante: {
        serie: 'EB01',
        numero: 100,
        cliente_tipo_documento: 'DNI',
        cliente_numero_documento: '72345678',
        detalles: [
          {
            codigo_producto: 'PAR-500',
            descripcion: 'Paracetamol 500mg',
            cantidad: 2,
            precio_unitario: 5.0,
          },
        ],
      },
    };

    const resultado = await provider.emitir(ctx);

    expect(resultado.exito).toBe(true);
    expect(resultado.estado).toBe('ACEPTADO');
    expect(resultado.ticket_sunat).toBe('EB01-00000100');
    expect(mockStorageService.guardarPdf).toHaveBeenCalled();
    expect(spyEmitir).toHaveBeenCalledWith(
      expect.objectContaining({
        receptor: expect.objectContaining({
          tipoDoc: '1',
          numeroDoc: '72345678',
        }),
        items: [
          expect.objectContaining({
            codigo: 'PAR-500',
            descripcion: 'Paracetamol 500mg',
            cantidad: 2,
            precioUnitario: 5.0,
          }),
        ],
      }),
    );
  });

  it('debe emitir comprobante con RUC correctamente hacia el bot de SUNAT SOL', async () => {
    const spyEmitir = jest
      .spyOn(botService, 'emitirBoletaSol')
      .mockResolvedValue({
        exito: true,
        numeroComprobante: 'EB01-00000101',
        serie: 'EB01',
        correlativo: 101,
        mensajeRespuesta: 'Aceptado por SUNAT SEE-SOL',
        pdfBuffer: Buffer.from('%PDF-1.4 test ruc'),
        duracionMs: 1600,
      });

    const ctx = {
      boticaId: 'botica-123',
      perfilTributario: {},
      comprobante: {
        serie: 'EB01',
        numero: 101,
        cliente_tipo_documento: 'RUC',
        cliente_numero_documento: '20123456789',
        detalles: [
          {
            codigo_producto: 'AMX-250',
            descripcion: 'Amoxicilina Jarabe 250mg',
            cantidad: 3,
            precio_unitario: 12.5,
          },
        ],
      },
    };

    const resultado = await provider.emitir(ctx);

    expect(resultado.exito).toBe(true);
    expect(resultado.estado).toBe('ACEPTADO');
    expect(resultado.ticket_sunat).toBe('EB01-00000101');
    expect(spyEmitir).toHaveBeenCalledWith(
      expect.objectContaining({
        receptor: expect.objectContaining({
          tipoDoc: '6',
          numeroDoc: '20123456789',
        }),
        items: [
          expect.objectContaining({
            codigo: 'AMX-250',
            descripcion: 'Amoxicilina Jarabe 250mg',
            cantidad: 3,
            precioUnitario: 12.5,
          }),
        ],
      }),
    );
  });

  it('debe manejar error si faltan credenciales SOL', async () => {
    mockPrismaService.perfiles_tributarios.findFirst.mockResolvedValueOnce(
      null,
    );
    mockPrismaService.configuraciones_tributarias.findUnique.mockResolvedValueOnce(
      null,
    );

    const ctx = {
      boticaId: 'botica-sin-config',
      perfilTributario: {},
      comprobante: { serie: 'EB01', numero: 1, detalles: [] },
    };

    const resultado = await provider.emitir(ctx);

    expect(resultado.exito).toBe(false);
    expect(resultado.codigo_respuesta).toBe('CREDENTIALS_MISSING');
  });
});
