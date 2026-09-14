import { Test, TestingModule } from '@nestjs/testing';
import { BibliotecaProductosService } from './biblioteca-productos.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BibliotecaProductosService', () => {
  let service: BibliotecaProductosService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BibliotecaProductosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BibliotecaProductosService>(BibliotecaProductosService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buscarPorCodigoBarras', () => {
    it('debe retornar el producto si coincide con el código de barras', async () => {
      const mockProducto = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        codigo_barras: '7750123456789',
        nombre_comercial: 'Panadol 500mg',
        principio_activo: 'Paracetamol',
        laboratorio: 'GSK',
      };

      (mockPrismaService.$queryRawUnsafe as jest.Mock).mockResolvedValue([mockProducto]);

      const result = await service.buscarPorCodigoBarras('7750123456789');

      expect(result).toEqual(mockProducto);
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM public.catalogo_maestro_productos'),
        '7750123456789',
      );
    });

    it('debe retornar null si el producto no existe en el catálogo maestro', async () => {
      (mockPrismaService.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

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

      const result = await service.findAll({ page: 1, limit: 10, buscar: 'pan' });

      expect(result.data).toEqual(mockItems);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });
  });
});
