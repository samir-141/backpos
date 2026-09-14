import { Test, TestingModule } from '@nestjs/testing';
import { TaxEngineService } from './tax-engine.service';
import { TaxValidatorService } from './tax-validator.service';
import { NrusRuleStrategy } from '../rules/nrus-rule.strategy';
import { RmtRuleStrategy } from '../rules/rmt-rule.strategy';
import { RerRuleStrategy } from '../rules/rer-rule.strategy';
import { GeneralRuleStrategy } from '../rules/general-rule.strategy';
import { PrismaService } from '../../../prisma/prisma.service';

describe('TaxEngineService', () => {
  let service: TaxEngineService;

  const mockPrismaService = {
    perfiles_tributarios: {
      findFirst: jest.fn(),
    },
    comprobantes_electronicos: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxEngineService,
        TaxValidatorService,
        NrusRuleStrategy,
        RmtRuleStrategy,
        RerRuleStrategy,
        GeneralRuleStrategy,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TaxEngineService>(TaxEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('NRUS Rules Evaluation', () => {
    const nrusProfile = {
      id: 'perfil-nrus-uuid',
      botica_id: 'botica-uuid',
      ruc: '10456789012',
      razon_social: 'FARMACIA SAN PEDRO',
      regimen_tributario: 'NRUS',
      configuracion_emision: {
        sistemaEmision: 'SEE_CF',
        ambiente: 'BETA',
      },
    };

    it('Scenario S/ 3.50 without receipt: receipt optional, eligible for daily consolidation', async () => {
      mockPrismaService.perfiles_tributarios.findFirst.mockResolvedValue(
        nrusProfile,
      );

      const result = await service.evaluateSale('botica-uuid', {
        total: 3.5,
      });

      expect(result.valid).toBe(true);
      expect(result.documentRequired).toBe(false);
      expect(result.canConsolidateDaily).toBe(true);
      expect(
        result.allowedDocumentTypes.some((d) => d.tipo === 'SIN_COMPROBANTE'),
      ).toBe(true);
    });

    it('Scenario S/ 15.00: receipt is mandatory, invoice is blocked for NRUS', async () => {
      mockPrismaService.perfiles_tributarios.findFirst.mockResolvedValue(
        nrusProfile,
      );

      const result = await service.evaluateSale('botica-uuid', {
        total: 15.0,
      });

      expect(result.valid).toBe(true);
      expect(result.documentRequired).toBe(true);
      expect(result.canConsolidateDaily).toBe(false);

      const facturaOption = result.allowedDocumentTypes.find(
        (d) => d.tipo === '01',
      );
      expect(facturaOption?.habilitado).toBe(false);
      expect(facturaOption?.motivoBloqueo).toBeDefined();
    });

    it('Scenario S/ 15.00 attempting to select Factura: returns error', async () => {
      mockPrismaService.perfiles_tributarios.findFirst.mockResolvedValue(
        nrusProfile,
      );

      const result = await service.evaluateSale('botica-uuid', {
        total: 15.0,
        tipoDocumentoSeleccionado: '01',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(
        'Nuevo RUS no permite la emisión de Facturas',
      );
    });

    it('Scenario S/ 850.00 (> S/ 700.00): customer identification is mandatory', async () => {
      mockPrismaService.perfiles_tributarios.findFirst.mockResolvedValue(
        nrusProfile,
      );

      const result = await service.evaluateSale('botica-uuid', {
        total: 850.0,
      });

      expect(result.customerDocumentRequired).toBe(true);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('700.00'))).toBe(true);
    });

    it('Scenario S/ 850.00 with valid DNI: evaluation is valid', async () => {
      mockPrismaService.perfiles_tributarios.findFirst.mockResolvedValue(
        nrusProfile,
      );

      const result = await service.evaluateSale('botica-uuid', {
        total: 850.0,
        cliente: {
          tipoDoc: '1',
          numeroDoc: '71234567',
          denominacion: 'JUAN PEREZ',
        },
      });

      expect(result.customerDocumentRequired).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('RMT / General Rules Evaluation', () => {
    const rmtProfile = {
      id: 'perfil-rmt-uuid',
      botica_id: 'botica-uuid',
      ruc: '20601234567',
      razon_social: 'BOTICA CENTRAL SAC',
      regimen_tributario: 'RMT',
      configuracion_emision: {
        sistemaEmision: 'SEE_CONTRIBUYENTE',
        ambiente: 'BETA',
      },
    };

    it('Scenario Factura in RMT requires valid RUC', async () => {
      mockPrismaService.perfiles_tributarios.findFirst.mockResolvedValue(
        rmtProfile,
      );

      const result = await service.evaluateSale('botica-uuid', {
        total: 120.0,
        tipoDocumentoSeleccionado: '01',
        cliente: {
          tipoDoc: '6',
          numeroDoc: '20609876543',
        },
      });

      expect(result.requiresValidRuc).toBe(true);
      const facturaOption = result.allowedDocumentTypes.find(
        (d) => d.tipo === '01',
      );
      expect(facturaOption?.habilitado).toBe(true);
    });
  });
});
