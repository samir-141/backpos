import { Test, TestingModule } from '@nestjs/testing';
import { BibliotecaProductosService } from './biblioteca-productos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ScraperProductosService } from './services/scraper-productos.service';

describe('BibliotecaProductosService', () => {
  let service: BibliotecaProductosService;
  let prisma: PrismaService;
  let scraperService: ScraperProductosService;

  const mockPrismaService = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockScraperService = {
    buscarEnApiExterna: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BibliotecaProductosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ScraperProductosService,
          useValue: mockScraperService,
        },
      ],
    }).compile();

    service = module.get<BibliotecaProductosService>(
      BibliotecaProductosService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    scraperService = module.get<ScraperProductosService>(
      ScraperProductosService,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buscarPorCodigoBarras', () => {
    it('debe retornar el producto si coincide con el catálogo maestro', async () => {
      const mockProducto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        codigo_barras: '7750123456789',
        nombre_comercial: 'Panadol 500mg',
        principio_activo: 'Paracetamol',
        laboratorio: 'GSK',
      };

      (mockPrismaService.$queryRawUnsafe as jest.Mock).mockResolvedValue([
        mockProducto,
      ]);

      const result = await service.buscarPorCodigoBarras('7750123456789');

      expect(result).toEqual({ ...mockProducto, origen: 'BIBLIOTECA_GLOBAL' });
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT * FROM public.catalogo_maestro_productos',
        ),
        '7750123456789',
      );
    });

    it('debe consultar la API externa y guardar si no existe en el catálogo maestro', async () => {
      (mockPrismaService.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce([]) // No está en catálogo maestro
        .mockResolvedValueOnce([
          {
            id: 'generated-id',
            codigo_barras: '7503004908691',
            nombre_comercial: 'PARACETAMOL 500MG 10 TABLETAS',
            laboratorio: 'ALPHARMA',
          },
        ]); // Retorno del INSERT

      mockScraperService.buscarEnApiExterna.mockResolvedValue({
        codigo_barras: '7503004908691',
        nombre_comercial: 'PARACETAMOL 500MG 10 TABLETAS',
        laboratorio: 'ALPHARMA',
        principio_activo: 'PARACETAMOL',
        concentracion: '500',
        unidad_concentracion: 'MG',
        forma_farmaceutica: 'TABLETA',
        unidad_presentacion: 'CAJA',
        unidad_base: 'TABLETA',
        cantidad_unidad_base: 10,
      });

      const result = await service.buscarPorCodigoBarras('7503004908691');

      expect(mockScraperService.buscarEnApiExterna).toHaveBeenCalledWith(
        '7503004908691',
      );
      expect(result).toEqual(
        expect.objectContaining({
          codigo_barras: '7503004908691',
          origen: 'API_EXTERNA',
        }),
      );
    });

    it('debe retornar null si tampoco existe en la API externa', async () => {
      (mockPrismaService.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
      mockScraperService.buscarEnApiExterna.mockResolvedValue(null);

      const result = await service.buscarPorCodigoBarras('9999999999999');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('debe listar productos con paginación', async () => {
      const mockItems = [
        { id: '1', nombre_comercial: 'Panadol' },
        { id: '2', nombre_comercial: 'Paracetamol' },
      ];

      (mockPrismaService.$queryRawUnsafe as jest.Mock)
        .mockResolvedValueOnce(mockItems)
        .mockResolvedValueOnce([{ total: 2 }]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        buscar: 'pan',
      });

      expect(result.data).toEqual(mockItems);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });
  });
});
