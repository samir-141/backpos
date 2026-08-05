import { Test, TestingModule } from '@nestjs/testing';
import { VentasService } from './ventas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../../socket/events.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const BOTICA_ID = 'botica-1';

type PrismaServiceMock = {
  $transaction: jest.Mock;
  ventas: {
    findFirst: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  comprobantes_publicos: {
    findFirst: jest.Mock;
  };
  [delegate: string]: unknown;
};

describe('VentasService - Posventa', () => {
  let service: VentasService;
  let prisma: PrismaServiceMock;
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
      comprobantes_publicos: {
        findFirst: jest.fn(),
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

      await expect(
        service.anular('venta-inexistente', BOTICA_ID),
      ).rejects.toThrow(NotFoundException);
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
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          comprobantes_publicos: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          tipos_movimientos_inventario: {
            findFirst: jest.fn().mockResolvedValue({ id: 'tipo-venta' }),
          },
          movimientos_inventario: {
            findMany: jest
              .fn()
              .mockResolvedValue([{ lote_id: 'lote-1', cantidad: 2 }]),
          },
          lotes: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        capturedTx = tx;
        return callback(tx);
      });

      const result = await service.anular('venta-1', BOTICA_ID, 'usuario-1');

      expect(result.exito).toBe(true);
      expect(result.mensaje).toContain('anulada exitosamente');
      expect(capturedTx.ventas.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'venta-1', estado: 'EMITIDO' }),
        }),
      );
      expect(capturedTx.lotes.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'lote-1',
          botica_id: BOTICA_ID,
          deleted_at: null,
        },
        data: { stock_actual: { increment: 2 } },
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
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          comprobantes_publicos: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          tipos_movimientos_inventario: {
            findFirst: jest.fn().mockResolvedValue({ id: 'tipo-venta' }),
          },
          movimientos_inventario: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        } as any;
        capturedTx = tx;
        return callback(tx);
      });

      const result = await service.anular('venta-1', BOTICA_ID, 'usuario-1');

      expect(result.exito).toBe(true);
      expect(capturedTx.ventas.updateMany).toHaveBeenCalled();
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
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          comprobantes_publicos: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          tipos_movimientos_inventario: {
            findFirst: jest.fn().mockResolvedValue({ id: 'tipo-venta' }),
          },
          movimientos_inventario: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          productos_presentaciones: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'presentacion-1',
              cantidad_unidad_base: 1,
            }),
          },
          lotes: {
            updateMany: jest.fn(),
          },
        };
        capturedTx = tx;
        return callback(tx);
      });

      const result = await service.anular('venta-1', BOTICA_ID, 'usuario-1');

      expect(result.exito).toBe(true);
      expect(capturedTx.lotes.updateMany).not.toHaveBeenCalled();
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

    function configurarVenta(options?: {
      precio?: number;
      cantidad?: number;
      equivalencia?: number;
      lotes?: Array<{ id: string; stock_actual: number; numero_lote: string }>;
    }) {
      const precio = options?.precio ?? 10;
      const cantidad = options?.cantidad ?? 2;
      const equivalencia = options?.equivalencia ?? 1;
      const lotes = options?.lotes ?? [
        { id: 'lote-1', stock_actual: 100, numero_lote: 'L1' },
      ];
      const tx = {
        usuarios: {
          findFirst: jest.fn().mockResolvedValue({ id: 'usuario-1' }),
        },
        sucursales: {
          findFirst: jest.fn().mockResolvedValue({ id: 'sucursal-1' }),
          findUnique: jest.fn(),
        },
        cajas: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'caja-1',
            estado: 'ABIERTA',
          }),
        },
        productos_presentaciones: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'presentacion-1',
            cantidad_unidad_base: equivalencia,
            precio_actual: precio,
            productos_comerciales: {
              id: 'producto-1',
              estado: 'ACTIVO',
              requiere_vencimiento: false,
              medicamentos: { afecto_igv: true },
            },
          }),
        },
        tipos_movimientos_inventario: {
          findFirst: jest.fn().mockResolvedValue({ id: 'tipo-venta' }),
        },
        ventas: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(({ data }) => ({
            id: 'venta-1',
            fecha: new Date('2026-08-01T12:00:00Z'),
            ...data,
          })),
        },
        lotes: {
          findMany: jest.fn().mockResolvedValue(
            lotes.map((lote) => ({
              ...lote,
              precio_compra_unidad_base: 0.5,
            })),
          ),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        movimientos_inventario: { create: jest.fn().mockResolvedValue({}) },
        detalles_ventas: {
          create: jest.fn().mockResolvedValue({ id: 'detalle-1' }),
          findMany: jest.fn().mockResolvedValue([]),
        },
        detalle_venta_lotes: {
          createMany: jest.fn().mockResolvedValue({ count: lotes.length }),
        },
        metodos_pago: {
          findFirst: jest.fn().mockResolvedValue({ id: 'metodo-1' }),
          create: jest.fn(),
        },
        pagos: { create: jest.fn().mockResolvedValue({}) },
        boticas: {
          findUnique: jest.fn().mockResolvedValue({ nombre: 'Botica' }),
        },
        comprobantes_publicos: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
      } as any;
      prisma.$transaction.mockImplementation(async (callback) => callback(tx));
      return { tx, cantidad };
    }

    it('recalcula precio y totales desde la presentación aunque el payload esté manipulado', async () => {
      const { tx } = configurarVenta({ precio: 10, cantidad: 2 });

      const result = await service.create(
        {
          tipo_comprobante: 'BOLETA',
          tipo_pago: 'CONTADO',
          metodo_pago: 'EFECTIVO',
          subtotal: 0.01,
          igv: 0,
          total: 0.01,
          items: [
            {
              producto_comercial_id: 'producto-1',
              producto_presentacion_id: 'presentacion-1',
              presentacion_nombre: 'Unidad',
              cantidad: 2,
              precio_unitario: 0.01,
            },
          ],
        },
        BOTICA_ID,
        'sucursal-1',
        'usuario-1',
      );

      expect(tx.ventas.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subtotal: 16.95,
          igv: 3.05,
          total: 20,
        }),
      });
      expect(tx.productos_presentaciones.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'presentacion-1',
            producto_comercial_id: 'producto-1',
            botica_id: BOTICA_ID,
            deleted_at: null,
          },
        }),
      );
      expect(tx.tipos_movimientos_inventario.findFirst).toHaveBeenCalledWith({
        where: { botica_id: BOTICA_ID, codigo: 'VENTA', deleted_at: null },
      });
      expect(tx.metodos_pago.findFirst).toHaveBeenCalledWith({
        where: {
          botica_id: BOTICA_ID,
          nombre: { equals: 'EFECTIVO', mode: 'insensitive' },
          deleted_at: null,
        },
      });
      expect(tx.pagos.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ monto: 20 }),
      });
      expect(result.total).toBe(20);
    });

    it('reparte 50/50 unidades base sin duplicar cantidad ni importe comercial', async () => {
      const { tx } = configurarVenta({
        precio: 20,
        cantidad: 1,
        equivalencia: 100,
        lotes: [
          { id: 'lote-1', stock_actual: 50, numero_lote: 'L1' },
          { id: 'lote-2', stock_actual: 50, numero_lote: 'L2' },
        ],
      });

      await service.create(
        {
          tipo_comprobante: 'BOLETA',
          tipo_pago: 'CONTADO',
          metodo_pago: 'EFECTIVO',
          items: [
            {
              producto_comercial_id: 'producto-1',
              producto_presentacion_id: 'presentacion-1',
              presentacion_nombre: 'Caja',
              cantidad: 1,
            },
          ],
        },
        BOTICA_ID,
        'sucursal-1',
        'usuario-1',
      );

      expect(tx.movimientos_inventario.create).toHaveBeenCalledTimes(2);
      expect(
        tx.movimientos_inventario.create.mock.calls.map(
          (call) => call[0].data.cantidad,
        ),
      ).toEqual([50, 50]);
      expect(tx.detalles_ventas.create).toHaveBeenCalledTimes(1);
      expect(tx.detalles_ventas.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cantidad: 1,
          subtotal: 20,
          unidades_base_por_presentacion: 100,
        }),
      });
      expect(tx.detalle_venta_lotes.createMany).toHaveBeenCalledWith({
        data: [
          {
            botica_id: BOTICA_ID,
            detalle_venta_id: 'detalle-1',
            lote_id: 'lote-1',
            unidades_base: 50,
            costo_unitario_base: 0.5,
          },
          {
            botica_id: BOTICA_ID,
            detalle_venta_id: 'detalle-1',
            lote_id: 'lote-2',
            unidades_base: 50,
            costo_unitario_base: 0.5,
          },
        ],
      });
    });

    it('registra la distribución multilote límite 99/1', async () => {
      const { tx } = configurarVenta({
        precio: 20,
        cantidad: 1,
        equivalencia: 100,
        lotes: [
          { id: 'lote-1', stock_actual: 99, numero_lote: 'L1' },
          { id: 'lote-2', stock_actual: 1, numero_lote: 'L2' },
        ],
      });

      await service.create(
        {
          tipo_comprobante: 'BOLETA',
          tipo_pago: 'CONTADO',
          metodo_pago: 'EFECTIVO',
          items: [
            {
              producto_comercial_id: 'producto-1',
              producto_presentacion_id: 'presentacion-1',
              presentacion_nombre: 'Caja',
              cantidad: 1,
            },
          ],
        },
        BOTICA_ID,
        'sucursal-1',
        'usuario-1',
      );

      expect(
        tx.detalle_venta_lotes.createMany.mock.calls[0][0].data.map(
          (asignacion: { unidades_base: number }) => asignacion.unidades_base,
        ),
      ).toEqual([99, 1]);
    });

    it('registra 150/50 al vender dos presentaciones de cien unidades', async () => {
      const { tx } = configurarVenta({
        precio: 20,
        cantidad: 2,
        equivalencia: 100,
        lotes: [
          { id: 'lote-1', stock_actual: 150, numero_lote: 'L1' },
          { id: 'lote-2', stock_actual: 50, numero_lote: 'L2' },
        ],
      });

      await service.create(
        {
          tipo_comprobante: 'BOLETA',
          tipo_pago: 'CONTADO',
          metodo_pago: 'EFECTIVO',
          items: [
            {
              producto_comercial_id: 'producto-1',
              producto_presentacion_id: 'presentacion-1',
              presentacion_nombre: 'Caja',
              cantidad: 2,
            },
          ],
        },
        BOTICA_ID,
        'sucursal-1',
        'usuario-1',
      );

      expect(
        tx.detalle_venta_lotes.createMany.mock.calls[0][0].data.map(
          (asignacion: { unidades_base: number }) => asignacion.unidades_base,
        ),
      ).toEqual([150, 50]);
      expect(tx.detalles_ventas.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cantidad: 2,
          unidades_base_por_presentacion: 100,
        }),
      });
    });

    it('anula una venta multilote reponiendo exactamente cada consumo', async () => {
      let txCapturado: any;
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'venta-1',
              estado: 'EMITIDO',
              detalles_ventas: [
                {
                  id: 'detalle-1',
                  cantidad: 1,
                  detalle_venta_lotes: [
                    { lote_id: 'lote-1', unidades_base: 99 },
                    { lote_id: 'lote-2', unidades_base: 1 },
                  ],
                },
              ],
            }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          comprobantes_publicos: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          tipos_movimientos_inventario: {
            findFirst: jest.fn().mockResolvedValue({ id: 'tipo-venta' }),
          },
          movimientos_inventario: {
            findMany: jest.fn(),
          },
          lotes: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        } as any;
        txCapturado = tx;
        return callback(tx);
      });

      await service.anular('venta-1', BOTICA_ID, 'usuario-1');

      expect(
        txCapturado.lotes.updateMany.mock.calls.map((call) => call[0].data),
      ).toEqual([
        { stock_actual: { increment: 99 } },
        { stock_actual: { increment: 1 } },
      ]);
      expect(
        txCapturado.movimientos_inventario.findMany,
      ).not.toHaveBeenCalled();
    });

    it('anula un detalle legacy usando el snapshot antes que la equivalencia actual', async () => {
      let txCapturado: any;
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          ventas: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'venta-legacy',
              estado: 'EMITIDO',
              detalles_ventas: [
                {
                  id: 'detalle-legacy',
                  cantidad: 2,
                  lote_id: 'lote-1',
                  producto_presentacion_id: 'presentacion-1',
                  unidades_base_por_presentacion: 100,
                  detalle_venta_lotes: [],
                },
              ],
            }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          comprobantes_publicos: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          tipos_movimientos_inventario: {
            findFirst: jest.fn().mockResolvedValue({ id: 'tipo-venta' }),
          },
          movimientos_inventario: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          productos_presentaciones: { findFirst: jest.fn() },
          lotes: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        } as any;
        txCapturado = tx;
        return callback(tx);
      });

      await service.anular('venta-legacy', BOTICA_ID, 'usuario-1');

      expect(
        txCapturado.productos_presentaciones.findFirst,
      ).not.toHaveBeenCalled();
      expect(txCapturado.lotes.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'lote-1',
          botica_id: BOTICA_ID,
          deleted_at: null,
        },
        data: { stock_actual: { increment: 200 } },
      });
    });

    it('un reintento secuencial devuelve la venta existente sin descontar ni cobrar otra vez', async () => {
      const { tx } = configurarVenta({ precio: 10, cantidad: 1 });
      const key = '11111111-1111-4111-8111-111111111111';
      tx.ventas.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'venta-1',
        subtotal: 8.47,
        igv: 1.53,
        total: 10,
        pagos: [{ metodos_pago: { nombre: 'EFECTIVO' } }],
      });
      tx.comprobantes_publicos.findFirst.mockResolvedValue({
        token_publico: 'token-1',
        snapshot: { tipo_comprobante: 'BOLETA', metodo_pago: 'EFECTIVO' },
      });
      const dto = {
        idempotency_key: key,
        tipo_comprobante: 'BOLETA',
        tipo_pago: 'CONTADO',
        metodo_pago: 'EFECTIVO',
        items: [
          {
            producto_comercial_id: 'producto-1',
            producto_presentacion_id: 'presentacion-1',
            presentacion_nombre: 'Unidad',
            cantidad: 1,
          },
        ],
      };

      const primera = await service.create(
        dto,
        BOTICA_ID,
        'sucursal-1',
        'usuario-1',
      );
      const reintento = await service.create(
        dto,
        BOTICA_ID,
        'sucursal-1',
        'usuario-1',
      );

      expect(primera.idempotente).toBe(false);
      expect(reintento).toEqual(
        expect.objectContaining({
          idempotente: true,
          venta_id: 'venta-1',
          total: 10,
          comprobante_url: '/c/token-1',
        }),
      );
      expect(tx.ventas.create).toHaveBeenCalledTimes(1);
      expect(tx.lotes.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.pagos.create).toHaveBeenCalledTimes(1);
    });

    it('reconcilia una carrera del índice único devolviendo la venta ganadora', async () => {
      const { tx } = configurarVenta({ precio: 10, cantidad: 1 });
      const key = '22222222-2222-4222-8222-222222222222';
      const dto = {
        idempotency_key: key,
        tipo_comprobante: 'BOLETA',
        tipo_pago: 'CONTADO',
        metodo_pago: 'EFECTIVO',
        items: [
          {
            producto_comercial_id: 'producto-1',
            producto_presentacion_id: 'presentacion-1',
            presentacion_nombre: 'Unidad',
            cantidad: 1,
          },
        ],
      };
      prisma.$transaction
        .mockImplementationOnce(async (callback) => callback(tx))
        .mockRejectedValueOnce({
          code: 'P2002',
          meta: { target: ['botica_id', 'idempotency_key'] },
        });
      prisma.ventas.findFirst.mockResolvedValue({
        id: 'venta-1',
        subtotal: 8.47,
        igv: 1.53,
        total: 10,
        pagos: [{ metodos_pago: { nombre: 'EFECTIVO' } }],
      } as any);
      prisma.comprobantes_publicos.findFirst.mockResolvedValue({
        token_publico: 'token-1',
        snapshot: { tipo_comprobante: 'BOLETA' },
      } as any);

      const [ganadora, concurrente] = await Promise.all([
        service.create(dto, BOTICA_ID, 'sucursal-1', 'usuario-1'),
        service.create(dto, BOTICA_ID, 'sucursal-1', 'usuario-1'),
      ]);

      expect(ganadora.venta_id).toBe('venta-1');
      expect(concurrente).toEqual(
        expect.objectContaining({ idempotente: true, venta_id: 'venta-1' }),
      );
      expect(tx.ventas.create).toHaveBeenCalledTimes(1);
      expect(tx.lotes.updateMany).toHaveBeenCalledTimes(1);
    });

    it('permite la misma clave de idempotencia en boticas distintas', async () => {
      const primero = configurarVenta({ precio: 10, cantidad: 1 }).tx;
      const segundo = configurarVenta({ precio: 10, cantidad: 1 }).tx;
      prisma.$transaction
        .mockImplementationOnce(async (callback) => callback(primero))
        .mockImplementationOnce(async (callback) => callback(segundo));
      const key = '33333333-3333-4333-8333-333333333333';
      const dto = {
        idempotency_key: key,
        tipo_comprobante: 'BOLETA',
        tipo_pago: 'CONTADO',
        metodo_pago: 'EFECTIVO',
        items: [
          {
            producto_comercial_id: 'producto-1',
            producto_presentacion_id: 'presentacion-1',
            presentacion_nombre: 'Unidad',
            cantidad: 1,
          },
        ],
      };

      await service.create(dto, BOTICA_ID, 'sucursal-1', 'usuario-1');
      await service.create(dto, 'botica-2', 'sucursal-1', 'usuario-1');

      expect(primero.ventas.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          botica_id: BOTICA_ID,
          idempotency_key: key,
        }),
      });
      expect(segundo.ventas.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          botica_id: 'botica-2',
          idempotency_key: key,
        }),
      });
    });
  });

  describe('findOne', () => {
    it('debería lanzar error cuando la venta no existe', async () => {
      prisma.ventas.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('venta-inexistente', BOTICA_ID),
      ).rejects.toThrow(NotFoundException);
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
