import { Test, TestingModule } from '@nestjs/testing';
import { PosventaService } from './posventa.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../../socket/events.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const BOTICA_ID = 'botica-1';

interface PrismaPosventaMock {
  $transaction: jest.Mock;
  ventas: { findFirst: jest.Mock; update: jest.Mock };
  lotes: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  detalles_ventas: { findFirst: jest.Mock };
  cajas: { findFirst: jest.Mock };
  sucursales: { findUnique: jest.Mock };
  movimientos_inventario: { create: jest.Mock };
  tipos_movimientos_inventario: { findFirst: jest.Mock };
  migracion_log: { create: jest.Mock };
}

describe('PosventaService', () => {
  let service: PosventaService;
  let prisma: PrismaPosventaMock;
  let auditService: jest.Mocked<AuditService>;
  let eventsGateway: jest.Mocked<EventsGateway>;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      ventas: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      lotes: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      detalles_ventas: {
        findFirst: jest.fn(),
      },
      cajas: {
        findFirst: jest.fn(),
      },
      sucursales: {
        findUnique: jest.fn(),
      },
      movimientos_inventario: {
        create: jest.fn(),
      },
      tipos_movimientos_inventario: {
        findFirst: jest.fn(),
      },
      migracion_log: {
        create: jest.fn(),
      },
    };

    auditService = {
      registrar: jest.fn(),
    } as any;

    eventsGateway = {
      emitirEvento: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosventaService,
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

    service = module.get<PosventaService>(PosventaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDevolucion', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('debería lanzar error cuando no hay items', async () => {
      await expect(
        service.createDevolucion(
          {
            venta_id: 'venta-1',
            motivo: 'Producto defectuoso',
            items: [],
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar error cuando la venta no existe', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        } as any;
        return callback(tx);
      });

      await expect(
        service.createDevolucion(
          {
            venta_id: 'venta-inexistente',
            motivo: 'Producto defectuoso',
            items: [{ detalle_venta_id: 'detalle-1', cantidad: 1 }],
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar error cuando la venta está anulada', async () => {
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

      await expect(
        service.createDevolucion(
          {
            venta_id: 'venta-1',
            motivo: 'Producto defectuoso',
            items: [{ detalle_venta_id: 'detalle-1', cantidad: 1 }],
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar error cuando el detalle de venta no existe', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'EMITIDO',
              detalles_ventas: [],
            }),
          },
        } as any;
        return callback(tx);
      });

      await expect(
        service.createDevolucion(
          {
            venta_id: 'venta-1',
            motivo: 'Producto defectuoso',
            items: [{ detalle_venta_id: 'detalle-inexistente', cantidad: 1 }],
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar error cuando la cantidad excede la comprada', async () => {
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
                },
              ],
            }),
          },
        } as any;
        return callback(tx);
      });

      await expect(
        service.createDevolucion(
          {
            venta_id: 'venta-1',
            motivo: 'Producto defectuoso',
            items: [{ detalle_venta_id: 'detalle-1', cantidad: 3 }],
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería reponer stock y registrar devolución exitosamente', async () => {
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
                  cantidad: 5,
                  lote_id: 'lote-1',
                },
              ],
            }),
          },
          lotes: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'lote-1',
              stock_actual: 100,
            }),
            update: jest.fn().mockResolvedValue({
              id: 'lote-1',
              stock_actual: 103,
            }),
          },
        };
        capturedTx = tx;
        return callback(tx);
      });

      const result = await service.createDevolucion(
        {
          venta_id: 'venta-1',
          motivo: 'Producto defectuoso',
          items: [{ detalle_venta_id: 'detalle-1', cantidad: 3 }],
        },
        BOTICA_ID,
      );

      expect(result.exito).toBe(true);
      expect(result.mensaje).toContain('correctamente');
      expect(capturedTx.lotes.update).toHaveBeenCalledWith({
        where: { id: 'lote-1' },
        data: { stock_actual: 103 },
      });
    });
  });

  describe('createCambio', () => {
    it('debería lanzar error cuando no hay items a devolver', async () => {
      await expect(
        service.createCambio(
          {
            venta_id: 'venta-1',
            motivo: 'Cliente quiere otro producto',
            items_devolver: [],
            items_entregar: [
              {
                producto_comercial_id: 'prod-1',
                cantidad: 1,
                precio_unitario: 50,
              },
            ],
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar error cuando no hay items a entregar', async () => {
      await expect(
        service.createCambio(
          {
            venta_id: 'venta-1',
            motivo: 'Cliente quiere otro producto',
            items_devolver: [
              {
                detalle_venta_id: 'detalle-1',
                cantidad: 1,
              },
            ],
            items_entregar: [],
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería procesar cambio exitosamente', async () => {
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
                },
              ],
              cajas: { sucursal_id: 'sucursal-1' },
            }),
          },
          lotes: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'lote-1',
              stock_actual: 100,
            }),
            update: jest.fn().mockResolvedValue({
              id: 'lote-1',
              stock_actual: 101,
            }),
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'lote-2',
                stock_actual: 50,
              },
            ]),
          },
        };
        return callback(tx);
      });

      const result = await service.createCambio(
        {
          venta_id: 'venta-1',
          motivo: 'Cliente quiere otro producto',
          items_devolver: [{ detalle_venta_id: 'detalle-1', cantidad: 1 }],
          items_entregar: [
            {
              producto_comercial_id: 'prod-2',
              cantidad: 1,
              precio_unitario: 50,
            },
          ],
        },
        BOTICA_ID,
      );

      expect(result.exito).toBe(true);
      expect(result.mensaje).toContain('correctamente');
    });
  });

  describe('createGarantia', () => {
    it('debería lanzar error cuando la venta no existe', async () => {
      prisma.ventas.findFirst.mockResolvedValue(null);

      await expect(
        service.createGarantia(
          {
            venta_id: 'venta-inexistente',
            detalle_venta_id: 'detalle-1',
            tipo: 'CAMBIO',
            motivo: 'Producto defectuoso',
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar error cuando la venta está anulada', async () => {
      prisma.ventas.findFirst.mockResolvedValue({
        id: 'venta-1',
        estado: 'ANULADO',
      } as any);

      await expect(
        service.createGarantia(
          {
            venta_id: 'venta-1',
            detalle_venta_id: 'detalle-1',
            tipo: 'CAMBIO',
            motivo: 'Producto defectuoso',
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería registrar garantía exitosamente', async () => {
      prisma.ventas.findFirst.mockResolvedValue({
        id: 'venta-1',
        estado: 'EMITIDO',
      } as any);

      const result = await service.createGarantia(
        {
          venta_id: 'venta-1',
          detalle_venta_id: 'detalle-1',
          tipo: 'CAMBIO',
          motivo: 'Producto defectuoso',
        },
        BOTICA_ID,
      );

      expect(result.exito).toBe(true);
      expect(result.tipo).toBe('CAMBIO');
      expect(auditService.registrar).toHaveBeenCalled();
      expect(eventsGateway.emitirEvento).toHaveBeenCalledWith(
        'garantia.registrada',
        {
          venta_id: 'venta-1',
          tipo: 'CAMBIO',
        },
      );
    });
  });

  describe('createReclamo', () => {
    it('debería lanzar error cuando la venta no existe', async () => {
      prisma.ventas.findFirst.mockResolvedValue(null);

      await expect(
        service.createReclamo(
          {
            venta_id: 'venta-inexistente',
            tipo: 'PRODUCTO',
            descripcion: 'Producto en mal estado',
          },
          BOTICA_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('debería registrar reclamo exitosamente', async () => {
      prisma.ventas.findFirst.mockResolvedValue({
        id: 'venta-1',
        estado: 'EMITIDO',
      } as any);

      const result = await service.createReclamo(
        {
          venta_id: 'venta-1',
          tipo: 'PRODUCTO',
          descripcion: 'Producto en mal estado',
        },
        BOTICA_ID,
      );

      expect(result.exito).toBe(true);
      expect(result.tipo).toBe('PRODUCTO');
      expect(auditService.registrar).toHaveBeenCalled();
      expect(eventsGateway.emitirEvento).toHaveBeenCalledWith(
        'reclamo.creado',
        {
          venta_id: 'venta-1',
          tipo: 'PRODUCTO',
        },
      );
    });
  });

  describe('findByVenta', () => {
    it('debería retornar historial de posventa', async () => {
      const result = await service.findByVenta('venta-1', BOTICA_ID);

      expect(result.venta_id).toBe('venta-1');
      expect(result.devoluciones).toEqual([]);
      expect(result.cambios).toEqual([]);
      expect(result.garantias).toEqual([]);
      expect(result.reclamos).toEqual([]);
    });
  });
});
