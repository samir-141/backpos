import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../socket/realtime.service';
import { ProductosService } from './productos.service';

const BOTICA_A = 'botica-a';
const BOTICA_B = 'botica-b';

const dto = {
  tipo_producto: 'OTRO',
  nombre_comercial: 'Producto compartido',
  sku: 'SKU-COMPARTIDO',
  codigo_interno: 'INT-COMPARTIDO',
  categoria_id: 'categoria-1',
  presentacion_id: 'unidad-1',
  unidad_base_id: 'unidad-1',
  cantidad_unidad_base: 1,
  precio_actual: 10,
  codigo_barras: '7750000000001',
};

function fixture(duplicateField?: 'sku' | 'codigo_interno' | 'codigo_barras') {
  const productosFindFirst = jest.fn(
    ({ where }: { where: Record<string, unknown> }) => {
      if (
        duplicateField !== 'codigo_barras' &&
        duplicateField &&
        where[duplicateField] &&
        (!where.botica_id || where.botica_id === BOTICA_A)
      ) {
        return { id: 'producto-a' };
      }
      return null;
    },
  );
  const presentacionesFindFirst = jest.fn(
    ({ where }: { where: Record<string, unknown> }) => {
      if (
        duplicateField === 'codigo_barras' &&
        where.codigo_barras &&
        (!where.botica_id || where.botica_id === BOTICA_A)
      ) {
        return { id: 'presentacion-a' };
      }
      return null;
    },
  );
  const transaction = jest
    .fn()
    .mockRejectedValue(new Error('transacción alcanzada'));
  const prismaMock = {
    productos_comerciales: { findFirst: productosFindFirst },
    productos_presentaciones: { findFirst: presentacionesFindFirst },
    $transaction: transaction,
  };
  const realtimeMock = {
    notificarStockActualizado: jest.fn(),
    notificarGeneral: jest.fn(),
  };
  return {
    service: new ProductosService(
      prismaMock as unknown as PrismaService,
      realtimeMock as unknown as RealtimeService,
    ),
    transaction,
    productosFindFirst,
    presentacionesFindFirst,
  };
}

function updateFixture() {
  const presentacionesFindFirst = jest.fn(
    ({ where }: { where: Record<string, unknown> }) =>
      !where.botica_id || where.botica_id === BOTICA_A
        ? { id: 'presentacion-a' }
        : null,
  );
  const transaction = jest
    .fn()
    .mockRejectedValue(new Error('transacción alcanzada'));
  const prismaMock = {
    productos_comerciales: {
      findFirst: jest.fn().mockResolvedValue({ id: 'producto-b' }),
    },
    productos_presentaciones: { findFirst: presentacionesFindFirst },
    $transaction: transaction,
  };
  return {
    service: new ProductosService(
      prismaMock as unknown as PrismaService,
      {
        notificarStockActualizado: jest.fn(),
        notificarGeneral: jest.fn(),
      } as unknown as RealtimeService,
    ),
    presentacionesFindFirst,
    transaction,
  };
}

describe('ProductosService unicidad por botica', () => {
  it.each(['sku', 'codigo_interno', 'codigo_barras'] as const)(
    'rechaza %s duplicado dentro de la misma botica',
    async (field) => {
      const f = fixture(field);

      await expect(
        f.service.create(BOTICA_A, { ...dto }, 'usuario-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(f.transaction).not.toHaveBeenCalled();
    },
  );

  it('permite que otra botica reutilice SKU, código interno y código de barras', async () => {
    const f = fixture();

    await expect(
      f.service.create(BOTICA_B, { ...dto }, 'usuario-1'),
    ).rejects.toThrow('transacción alcanzada');

    expect(f.productosFindFirst).toHaveBeenCalledWith({
      where: { sku: dto.sku, botica_id: BOTICA_B, deleted_at: null },
    });
    expect(f.productosFindFirst).toHaveBeenCalledWith({
      where: {
        codigo_interno: dto.codigo_interno,
        botica_id: BOTICA_B,
        deleted_at: null,
      },
    });
    expect(f.presentacionesFindFirst).toHaveBeenCalledWith({
      where: {
        codigo_barras: dto.codigo_barras,
        botica_id: BOTICA_B,
        deleted_at: null,
      },
    });
  });

  it('rechaza al editar un código de barras duplicado en la misma botica', async () => {
    const f = updateFixture();

    await expect(
      f.service.update(BOTICA_A, 'producto-a', {
        codigo_barras: dto.codigo_barras,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it('permite al editar reutilizar un código de barras de otra botica', async () => {
    const f = updateFixture();

    await expect(
      f.service.update(BOTICA_B, 'producto-b', {
        codigo_barras: dto.codigo_barras,
      }),
    ).rejects.toThrow('transacción alcanzada');
    expect(f.presentacionesFindFirst).toHaveBeenCalledWith({
      where: {
        codigo_barras: dto.codigo_barras,
        botica_id: BOTICA_B,
        deleted_at: null,
        NOT: { producto_comercial_id: 'producto-b' },
      },
    });
  });
});
