import { validate } from 'class-validator';
import { ForbiddenException } from '@nestjs/common';
import { CajasService } from './cajas.service';
import { MovimientoCajaDto, TipoMovimientoCaja } from './dto/cajas.dto';

function fixture(failMovement = false) {
  const caja: any = {
    id: 'caja-1',
    nombre: 'Caja Principal',
    estado: 'CERRADA',
    sucursal_id: 'sucursal-1',
    botica_id: 'botica-1',
  };
  const movimientos: any[] = [];
  const tx: any = {
    $executeRawUnsafe: jest.fn(),
    cajas: {
      findFirst: jest.fn(async () => ({ ...caja })),
      updateMany: jest.fn(async ({ where, data }) => {
        if (caja.estado !== where.estado) return { count: 0 };
        caja.estado = data.estado;
        return { count: 1 };
      }),
      create: jest.fn(),
      count: jest.fn(async () => (caja.estado === 'ABIERTA' ? 1 : 0)),
    },
    sucursales: { findFirst: jest.fn() },
    movimientos_caja: {
      create: jest.fn(async ({ data }) => {
        if (failMovement) throw new Error('fallo movimiento');
        movimientos.push(data);
        return data;
      }),
    },
  };
  let transactionQueue = Promise.resolve();
  const prisma: any = {
    usuarios: { findFirst: jest.fn().mockResolvedValue({ id: 'usuario-1' }) },
    usuario_sucursales: {
      findFirst: jest.fn().mockResolvedValue({ sucursal_id: 'sucursal-1' }),
    },
    $transaction: jest.fn(async (work) => {
      const previous = transactionQueue;
      let release!: () => void;
      transactionQueue = new Promise<void>((resolve) => (release = resolve));
      await previous;
      const initialState = caja.estado;
      const initialMoves = movimientos.length;
      try {
        return await work(tx);
      } catch (error) {
        caja.estado = initialState;
        movimientos.splice(initialMoves);
        throw error;
      } finally {
        release();
      }
    }),
  };
  return { prisma, caja, movimientos };
}

describe('CajasService atomicidad', () => {
  const realtime: any = {
    notificarCajaAperturada: jest.fn(),
    notificarCajaCerrada: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('solo permite una apertura ante dos solicitudes simultáneas', async () => {
    const f = fixture();
    const service = new CajasService(f.prisma, realtime);
    const results = await Promise.allSettled([
      service.aperturarCaja('botica-1', 'usuario-1', 'sucursal-1', {
        monto_inicial: 50,
      }),
      service.aperturarCaja('botica-1', 'usuario-1', 'sucursal-1', {
        monto_inicial: 50,
      }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(f.caja.estado).toBe('ABIERTA');
    expect(f.movimientos).toHaveLength(1);
  });

  it('rechaza operar una sucursal no asignada al usuario', async () => {
    const f = fixture();
    f.prisma.usuario_sucursales.findFirst.mockResolvedValue(null);
    const service = new CajasService(f.prisma, realtime);
    await expect(
      service.getEstadoCaja('botica-1', 'usuario-1', 'sucursal-ajena'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('revierte la transición si falla el movimiento de apertura', async () => {
    const f = fixture(true);
    const service = new CajasService(f.prisma, realtime);
    await expect(
      service.aperturarCaja('botica-1', 'usuario-1', 'sucursal-1', {
        monto_inicial: 50,
      }),
    ).rejects.toThrow('fallo movimiento');
    expect(f.caja.estado).toBe('CERRADA');
    expect(realtime.notificarCajaAperturada).not.toHaveBeenCalled();
  });

  it('valida tipo de movimiento como enum INGRESO/EGRESO', async () => {
    const dto = new MovimientoCajaDto();
    dto.tipo = 'OTRO' as TipoMovimientoCaja;
    dto.monto = 10;
    dto.observacion = 'prueba';
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'tipo')).toBe(true);
  });
});
