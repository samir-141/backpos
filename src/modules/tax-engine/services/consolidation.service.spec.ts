import { Test, TestingModule } from '@nestjs/testing';
import { ConsolidationService } from './consolidation.service';
import { TaxEngineService } from './tax-engine.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('ConsolidationService', () => {
  let service: ConsolidationService;

  const mockPrismaService = {
    ventas: {
      findMany: jest.fn(),
    },
  };

  const mockTaxEngineService = {
    getActiveTaxProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsolidationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TaxEngineService, useValue: mockTaxEngineService },
      ],
    }).compile();

    service = module.get<ConsolidationService>(ConsolidationService);
  });

  it('should calculate pending sub-S/5 sales correctly', async () => {
    mockPrismaService.ventas.findMany.mockResolvedValue([
      { id: 'v1', total: 2.5, fecha: new Date(), created_at: new Date() },
      { id: 'v2', total: 1.5, fecha: new Date(), created_at: new Date() },
      { id: 'v3', total: 3.0, fecha: new Date(), created_at: new Date() },
    ]);

    const result = await service.getPendingSubFiveSales(
      'botica-uuid',
      'caja-uuid',
    );

    expect(result.cantidadOperaciones).toBe(3);
    expect(result.totalAcumulado).toBe(7.0);
  });

  it('should throw BadRequestException if no sub-S/5 sales pending when consolidating', async () => {
    mockPrismaService.ventas.findMany.mockResolvedValue([]);

    await expect(
      service.consolidateDailySales(
        'botica-uuid',
        { cajaId: 'caja-uuid' },
        'user-uuid',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
