import { ForbiddenException } from '@nestjs/common';
import { ProductosService } from './productos.service';

function fixture(options?: { failExpense?: boolean }) {
  let stock = 100;
  const movimientos: any[] = [];
  const gastos: any[] = [];
  const tx: any = {
    tipos_movimientos_inventario: {
      findFirst: jest.fn().mockResolvedValue({ id: 'tipo-1' }),
      create: jest.fn(),
    },
    lotes: {
      findFirst: jest.fn(async () => ({
        id: 'lote-1',
        stock_actual: stock,
        fecha_vencimiento: null,
      })),
      update: jest.fn(async ({ data }) => {
        stock += data.stock_actual.increment;
        return { id: 'lote-1', stock_actual: stock, fecha_vencimiento: null };
      }),
      create: jest.fn(),
    },
    movimientos_inventario: {
      create: jest.fn(async ({ data }) => {
        movimientos.push(data);
        return { id: `mov-${movimientos.length}`, ...data };
      }),
    },
    gastos_operativos: {
      create: jest.fn(async ({ data }) => {
        if (options?.failExpense) throw new Error('fallo gasto');
        gastos.push(data);
        return data;
      }),
    },
  };
  const prisma: any = {
    usuario_sucursales: {
      findFirst: jest.fn().mockResolvedValue({ sucursal_id: 'sucursal-1' }),
    },
    productos_comerciales: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'producto-1',
        controla_lote: true,
        requiere_vencimiento: false,
      }),
    },
    $transaction: jest.fn(async (work) => {
      const snapshot = {
        stock,
        movimientos: movimientos.length,
        gastos: gastos.length,
      };
      try {
        return await work(tx);
      } catch (error) {
        stock = snapshot.stock;
        movimientos.splice(snapshot.movimientos);
        gastos.splice(snapshot.gastos);
        throw error;
      }
    }),
  };
  return { prisma, getStock: () => stock, movimientos, gastos };
}

describe('ProductosService reabastecimiento atómico', () => {
  const realtime: any = {
    notificarStockActualizado: jest.fn(),
    notificarGeneral: jest.fn(),
  };
  const dto = {
    producto_comercial_id: 'producto-1',
    sucursal_id: 'sucursal-1',
    numero_lote: 'L-1',
    stock_adicional: 10,
    precio_compra_base: 2,
  };

  beforeEach(() => jest.clearAllMocks());

  it('rechaza una sucursal que no está asignada', async () => {
    const f = fixture();
    f.prisma.usuario_sucursales.findFirst.mockResolvedValue(null);
    const service = new ProductosService(f.prisma, realtime);
    await expect(
      service.reabastecerStock('botica-1', dto, 'usuario-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('usa increment atómico y conserva ambos ingresos concurrentes', async () => {
    const f = fixture();
    const service = new ProductosService(f.prisma, realtime);
    await Promise.all([
      service.reabastecerStock('botica-1', dto, 'usuario-1'),
      service.reabastecerStock('botica-1', dto, 'usuario-1'),
    ]);
    expect(f.getStock()).toBe(120);
    expect(f.movimientos).toHaveLength(2);
    expect(f.gastos).toHaveLength(2);
  });

  it('revierte lote y movimiento si falla el registro del gasto', async () => {
    const f = fixture({ failExpense: true });
    const service = new ProductosService(f.prisma, realtime);
    await expect(
      service.reabastecerStock('botica-1', dto, 'usuario-1'),
    ).rejects.toThrow('fallo gasto');
    expect(f.getStock()).toBe(100);
    expect(f.movimientos).toHaveLength(0);
    expect(realtime.notificarStockActualizado).not.toHaveBeenCalled();
  });
});
