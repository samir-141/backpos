import { Test, TestingModule } from '@nestjs/testing';
import { VentasService } from './ventas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../../socket/events.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const BOTICA_ID = 'botica-1';

describe('VentasService - Posventa', () => {
  let service: VentasService;
  let prisma: jest.Mocked<PrismaService>;
  let auditService: jest.Mocked<AuditService>;
  let eventsGateway: jest.Mocked<EventsGateway>;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      ventas: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      lotes: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      productos_presentaciones: {
        findFirst: jest.fn(),
      },
      detalles_ventas: {
        findFirst: jest.fn(),
      },
      cajas: {
        findFirst: jest.fn(),
      },
      sucursales: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      usuarios: {
        findFirst: jest.fn(),
      },
      movimientos_inventario: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      tipos_movimientos_inventario: {
        findFirst: jest.fn(),
      },
      pagos: {
        create: jest.fn(),
      },
      metodos_pago: {
        findFirst: jest.fn(),
      },
      clientes: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      migracion_log: {
        create: jest.fn(),
      },
    } as any;

    auditService = {
      registrar: jest.fn(),
    } as any;

    eventsGateway = {
      emitirEvento: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VentasService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
        {
          provide: EventsGateway,
          useValue: eventsGateway,
        },
      ],
    }).compile();

    service = module.get<VentasService>(VentasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('anular', () => {
    it('debería lanzar error cuando la venta no existe', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        } as any;
        return callback(tx);
      });

      await expect(service.anular('venta-inexistente', BOTICA_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debería lanzar error cuando la venta ya está anulada', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'ANULADO',
              detalles_ventas: [],
            }),
          },
        } as any;
        return callback(tx);
      });

      await expect(service.anular('venta-1', BOTICA_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debería anular venta y reponer stock exitosamente', async () => {
      let capturedTx: any;
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'EMITIDO',
              detalles_ventas: [
                {
                  id: 'detalle-1',
                  cantidad: 2,
                  lote_id: 'lote-1',
                  producto_presentacion_id: 'presentacion-1',
                },
              ],
            }),
            update: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'ANULADO',
            }),
          },
          productos_presentaciones: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'presentacion-1',
              cantidad_unidad_base: 1,
            }),
          },
          lotes: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'lote-1',
              stock_actual: 50,
            }),
            update: jest.fn().mockResolvedValue({
              id: 'lote-1',
              stock_actual: 52,
            }),
          },
        };
        capturedTx = tx;
        return callback(tx);
      });

      const result = await service.anular('venta-1', BOTICA_ID, 'usuario-1');

      expect(result.exito).toBe(true);
      expect(result.mensaje).toContain('anulada exitosamente');
      expect(capturedTx.ventas.update).toHaveBeenCalledWith({
        where: { id: 'venta-1' },
        data: {
          estado: 'ANULADO',
          updated_at: expect.any(Date),
          updated_by: 'usuario-1',
        },
      });
    });

    it('debería manejar venta sin detalles al anular', async () => {
      let capturedTx: any;
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'EMITIDO',
              detalles_ventas: [],
            }),
            update: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'ANULADO',
            }),
          },
        } as any;
        capturedTx = tx;
        return callback(tx);
      });

      const result = await service.anular('venta-1', BOTICA_ID, 'usuario-1');

      expect(result.exito).toBe(true);
      expect(capturedTx.ventas.update).toHaveBeenCalled();
    });

    it('debería manejar detalle sin lote al anular', async () => {
      let capturedTx: any;
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'EMITIDO',
              detalles_ventas: [
                {
                  id: 'detalle-1',
                  cantidad: 2,
                  lote_id: null,
                  producto_presentacion_id: 'presentacion-1',
                },
              ],
            }),
            update: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'ANULADO',
            }),
          },
          productos_presentaciones: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'presentacion-1',
              cantidad_unidad_base: 1,
            }),
          },
          lotes: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
          },
        };
        capturedTx = tx;
        return callback(tx);
      });

      const result = await service.anular('venta-1', BOTICA_ID, 'usuario-1');

      expect(result.exito).toBe(true);
      expect(capturedTx.lotes.update).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('debería lanzar error cuando no hay items', async () => {
      await expect(
        service.create(
          {
            tipo_comprobante: 'BOLETA',
            tipo_pago: 'EFECTIVO',
            metodo_pago: 'EFECTIVO',
            subtotal: 100,
            igv: 18,
            total: 118,
            items: [],
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('debería lanzar error cuando la venta no existe', async () => {
      prisma.ventas.findFirst.mockResolvedValue(null);

      await expect(service.findOne('venta-inexistente', BOTICA_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debería retornar venta cuando existe', async () => {
      prisma.ventas.findFirst.mockResolvedValue({
        id: 'venta-1',
        estado: 'EMITIDO',
        detalles_ventas: [],
        pagos: [],
        clientes: null,
      } as any);

      const result = await service.findOne('venta-1', BOTICA_ID);

      expect(result.id).toBe('venta-1');
    });
  });
});