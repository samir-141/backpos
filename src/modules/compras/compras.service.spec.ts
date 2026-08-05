import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ComprasService } from './compras.service';
import { CreateCompraDto } from './dto/compras.dto';

const BOTICA_ID = '11111111-1111-4111-8111-111111111111';
const USUARIO_ID = '22222222-2222-4222-8222-222222222222';
const SUCURSAL_ID = '33333333-3333-4333-8333-333333333333';
const PROVEEDOR_ID = '44444444-4444-4444-8444-444444444444';
const PRESENTACION_ID = '55555555-5555-4555-8555-555555555555';
const PRODUCTO_ID = '66666666-6666-4666-8666-666666666666';

type TxMock = ReturnType<typeof createTx>;
type TransactionRunner = (
  callback: (client: TxMock) => Promise<unknown>,
  options?: unknown,
) => Promise<unknown>;

function resolvedMock<T>(value: T) {
  return jest.fn<Promise<T>, unknown[]>().mockResolvedValue(value);
}

function capturedMock<T>(calls: unknown[], value: T) {
  return jest.fn((input: unknown): Promise<T> => {
    calls.push(input);
    return Promise.resolve(value);
  });
}

function compraPersistida() {
  return {
    id: 'compra-1',
    botica_id: BOTICA_ID,
    proveedor_id: PROVEEDOR_ID,
    usuario_id: USUARIO_ID,
    sucursal_id: SUCURSAL_ID,
    fecha: new Date('2026-08-01T12:00:00.000Z'),
    serie: 'F001',
    numero: '100',
    subtotal: new Prisma.Decimal(20),
    igv: new Prisma.Decimal(3.6),
    total: new Prisma.Decimal(23.6),
    proveedores: {
      id: PROVEEDOR_ID,
      ruc: '20100070970',
      razon_social: 'Proveedor Demo SAC',
    },
    sucursales: { id: SUCURSAL_ID, nombre: 'Principal' },
    usuarios: { id: USUARIO_ID, nombre: 'Administrador' },
    detalles_compras: [
      {
        id: 'detalle-1',
        cantidad: 2,
        precio_unitario: new Prisma.Decimal(10),
        productos_presentaciones: {
          id: PRESENTACION_ID,
          cantidad_unidad_base: 10,
          productos_comerciales: {
            id: PRODUCTO_ID,
            nombre_comercial: 'Producto Demo',
            sku: 'DEMO-1',
          },
          unidades_presentacion: {
            id: 'unidad-1',
            nombre: 'Blíster',
            abreviatura: 'bls',
          },
        },
        lotes: [],
      },
    ],
  };
}

function createTx() {
  const captures = {
    compraCreate: [] as unknown[],
    loteCreate: [] as unknown[],
    loteUpdate: [] as unknown[],
    movimientoCreate: [] as unknown[],
    gastoCreate: [] as unknown[],
    comprasFindMany: [] as unknown[],
  };
  const compraFindFirst = resolvedMock<ReturnType<
    typeof compraPersistida
  > | null>(null);
  compraFindFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(compraPersistida());
  return {
    $executeRawUnsafe: resolvedMock(1),
    usuarios: {
      findFirst: resolvedMock({ id: USUARIO_ID }),
    },
    usuario_sucursales: {
      findFirst: resolvedMock<{ sucursal_id: string } | null>({
        sucursal_id: SUCURSAL_ID,
      }),
    },
    compras: {
      findFirst: compraFindFirst,
      create: capturedMock(captures.compraCreate, { id: 'compra-1' }),
      findMany: capturedMock<unknown[]>(captures.comprasFindMany, []),
      count: resolvedMock(0),
    },
    proveedores: {
      findFirst: resolvedMock<{
        id: string;
        razon_social: string;
      } | null>({
        id: PROVEEDOR_ID,
        razon_social: 'Proveedor Demo SAC',
      }),
    },
    productos_presentaciones: {
      findMany: resolvedMock([
        {
          id: PRESENTACION_ID,
          cantidad_unidad_base: 10,
          productos_comerciales: {
            id: PRODUCTO_ID,
            controla_lote: true,
            requiere_vencimiento: true,
            medicamentos: { afecto_igv: true },
          },
        },
      ]),
    },
    tipos_movimientos_inventario: {
      findFirst: resolvedMock<{ id: string } | null>({ id: 'tipo-compra' }),
      create: resolvedMock({ id: 'tipo-compra' }),
    },
    detalles_compras: {
      create: resolvedMock({ id: 'detalle-1' }),
      update: resolvedMock({ id: 'detalle-1' }),
    },
    lotes: {
      findFirst: resolvedMock<{
        id: string;
        numero_lote: string;
        fecha_fabricacion: Date | null;
        fecha_vencimiento: Date | null;
        precio_compra_unidad_base: Prisma.Decimal;
        stock_actual: number;
      } | null>(null),
      create: capturedMock(captures.loteCreate, {
        id: 'lote-1',
        stock_actual: 20,
      }),
      update: capturedMock(captures.loteUpdate, {
        id: 'lote-1',
        stock_actual: 100,
      }),
    },
    movimientos_inventario: {
      create: capturedMock(captures.movimientoCreate, { id: 'movimiento-1' }),
    },
    gastos_operativos: {
      create: capturedMock(captures.gastoCreate, { id: 'gasto-1' }),
    },
    captures,
  };
}

function dto(overrides: Partial<CreateCompraDto> = {}): CreateCompraDto {
  return {
    proveedor_id: PROVEEDOR_ID,
    sucursal_id: SUCURSAL_ID,
    serie: 'f001',
    numero: '100',
    subtotal: 0.01,
    igv: 0,
    total: 0.01,
    detalles: [
      {
        producto_presentacion_id: PRESENTACION_ID,
        cantidad: 2,
        costo_unitario: 10,
        numero_lote: ' lote-a ',
        fecha_fabricacion: '2026-01-01',
        fecha_vencimiento: '2027-12-31',
      },
    ],
    ...overrides,
  };
}

describe('ComprasService', () => {
  let prisma: { $transaction: jest.MockedFunction<TransactionRunner> } & TxMock;
  let tx: TxMock;
  let service: ComprasService;
  let transactionOptions: unknown;

  beforeEach(() => {
    tx = createTx();
    const transactionRunner: TransactionRunner = (callback, options) => {
      transactionOptions = options;
      return callback(tx);
    };
    prisma = {
      ...tx,
      $transaction: jest.fn(transactionRunner),
    };
    service = new ComprasService(prisma as unknown as PrismaService);
  });

  it('crea compra, lote, movimiento e inversión con montos recalculados', async () => {
    const result = await service.create(
      BOTICA_ID,
      USUARIO_ID,
      SUCURSAL_ID,
      dto(),
    );

    const compraCreate = tx.captures.compraCreate[0] as {
      data: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(compraCreate).toMatchObject({ select: { id: true } });
    expect(compraCreate.data).toMatchObject({
      botica_id: BOTICA_ID,
      subtotal: new Prisma.Decimal(20),
      igv: new Prisma.Decimal(3.6),
      total: new Prisma.Decimal(23.6),
    });
    const loteCreate = tx.captures.loteCreate[0] as {
      data: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(loteCreate).toMatchObject({
      select: { id: true, stock_actual: true },
    });
    expect(loteCreate.data).toMatchObject({
      botica_id: BOTICA_ID,
      sucursal_id: SUCURSAL_ID,
      numero_lote: 'LOTE-A',
      stock_actual: 20,
      precio_compra_unidad_base: new Prisma.Decimal(1),
    });
    const movimientoCreate = tx.captures.movimientoCreate[0] as {
      data: Record<string, unknown>;
    };
    expect(movimientoCreate.data).toMatchObject({
      cantidad: 20,
      stock_anterior: 0,
      stock_nuevo: 20,
      documento_referencia: 'F001-100',
    });
    const gastoCreate = tx.captures.gastoCreate[0] as {
      data: Record<string, unknown>;
    };
    expect(gastoCreate.data).toMatchObject({
      tipo: 'INVERSION',
      categoria: 'COMPRA_INVENTARIO',
      monto: new Prisma.Decimal(23.6),
    });
    expect(result).toEqual(
      expect.objectContaining({ total: 23.6, idempotente: false }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionOptions).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('incrementa un lote compatible y recalcula su costo promedio ponderado', async () => {
    tx.lotes.findFirst.mockResolvedValue({
      id: 'lote-1',
      numero_lote: 'LOTE-A',
      fecha_fabricacion: new Date('2026-01-01T00:00:00.000Z'),
      fecha_vencimiento: new Date('2027-12-31T00:00:00.000Z'),
      precio_compra_unidad_base: new Prisma.Decimal(0.5),
      stock_actual: 80,
    });
    await service.create(BOTICA_ID, USUARIO_ID, SUCURSAL_ID, dto());

    expect(tx.lotes.create).not.toHaveBeenCalled();
    const loteUpdate = tx.captures.loteUpdate[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(loteUpdate).toMatchObject({
      where: { id: 'lote-1' },
      select: { id: true, stock_actual: true },
    });
    expect(loteUpdate.data).toMatchObject({
      stock_actual: { increment: 20 },
      precio_compra_unidad_base: new Prisma.Decimal(0.6),
    });
  });

  it('rechaza proveedor, sucursal o presentación de otro tenant', async () => {
    tx.usuario_sucursales.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create(BOTICA_ID, USUARIO_ID, SUCURSAL_ID, dto()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    tx.compras.findFirst.mockReset().mockResolvedValue(null);
    tx.usuario_sucursales.findFirst.mockResolvedValue({
      sucursal_id: SUCURSAL_ID,
    });
    tx.proveedores.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create(BOTICA_ID, USUARIO_ID, SUCURSAL_ID, dto()),
    ).rejects.toBeInstanceOf(BadRequestException);

    tx.proveedores.findFirst.mockResolvedValue({
      id: PROVEEDOR_ID,
      razon_social: 'Proveedor Demo SAC',
    });
    tx.productos_presentaciones.findMany.mockResolvedValueOnce([]);
    await expect(
      service.create(BOTICA_ID, USUARIO_ID, SUCURSAL_ID, dto()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('propaga un fallo final para que Prisma revierta toda la transacción', async () => {
    tx.gastos_operativos.create.mockRejectedValueOnce(
      new Error('fallo de inversión'),
    );
    await expect(
      service.create(BOTICA_ID, USUARIO_ID, SUCURSAL_ID, dto()),
    ).rejects.toThrow('fallo de inversión');
    expect(tx.compras.create).toHaveBeenCalled();
    expect(tx.movimientos_inventario.create).toHaveBeenCalled();
  });

  it('una segunda solicitud del mismo comprobante es idempotente', async () => {
    tx.compras.findFirst
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(compraPersistida())
      .mockResolvedValueOnce(compraPersistida());

    const first = await service.create(
      BOTICA_ID,
      USUARIO_ID,
      SUCURSAL_ID,
      dto(),
    );
    const second = await service.create(
      BOTICA_ID,
      USUARIO_ID,
      SUCURSAL_ID,
      dto(),
    );

    expect(first.idempotente).toBe(false);
    expect(second.idempotente).toBe(true);
    expect(tx.compras.create).toHaveBeenCalledTimes(1);
    expect(tx.movimientos_inventario.create).toHaveBeenCalledTimes(1);
    expect(tx.gastos_operativos.create).toHaveBeenCalledTimes(1);
  });

  it('lista únicamente la sucursal asignada dentro de la botica', async () => {
    prisma.compras.count.mockResolvedValue(0);

    await service.findAll(BOTICA_ID, USUARIO_ID, SUCURSAL_ID, {
      page: 1,
      limit: 20,
    });

    const listArgs = tx.captures.comprasFindMany[0] as {
      where: Record<string, unknown>;
    };
    expect(listArgs.where).toMatchObject({
      botica_id: BOTICA_ID,
      sucursal_id: SUCURSAL_ID,
      deleted_at: null,
    });
  });

  it('impide consultar el detalle de una sucursal no asignada', async () => {
    prisma.compras.findFirst.mockReset().mockResolvedValue(compraPersistida());
    prisma.usuario_sucursales.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.findOne(BOTICA_ID, USUARIO_ID, 'compra-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.compras.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'compra-1',
          botica_id: BOTICA_ID,
          deleted_at: null,
        },
      }),
    );
  });
});
