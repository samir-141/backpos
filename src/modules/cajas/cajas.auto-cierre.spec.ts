import { CajasService } from './cajas.service';

describe('CajasService Auto-Cierre por cambio de día', () => {
  const realtime: any = {
    notificarCajaAperturada: jest.fn(),
    notificarCajaCerrada: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cierra automáticamente la caja si fue aperturada un día anterior al consultar getEstadoCaja', async () => {
    // Apertura ayer (2026-09-01)
    const fechaAperturaAyer = new Date('2020-01-01T10:00:00Z');

    const caja: any = {
      id: 'caja-1',
      nombre: 'Caja Principal',
      estado: 'ABIERTA',
      sucursal_id: 'sucursal-1',
      botica_id: 'botica-1',
    };

    const movimientos: any[] = [
      {
        id: 'mov-1',
        caja_id: 'caja-1',
        tipo: 'APERTURA',
        monto: '100.00',
        fecha: fechaAperturaAyer,
        deleted_at: null,
      },
    ];

    const tx: any = {
      $executeRawUnsafe: jest.fn(),
      cajas: {
        findFirst: jest.fn(async () => ({ ...caja })),
        updateMany: jest.fn(async ({ where, data }) => {
          if (caja.estado !== where.estado) return { count: 0 };
          caja.estado = data.estado;
          return { count: 1 };
        }),
      },
      movimientos_caja: {
        findFirst: jest.fn(async ({ where }) => {
          if (where.tipo === 'APERTURA') return movimientos[0];
          return null;
        }),
        findMany: jest.fn(async () => []),
        create: jest.fn(async ({ data }) => {
          movimientos.push(data);
          return data;
        }),
      },
      ventas: {
        findMany: jest.fn(async () => []),
      },
    };

    const prisma: any = {
      usuarios: {
        findFirst: jest.fn().mockResolvedValue({ id: 'usuario-1' }),
      },
      usuario_sucursales: {
        findFirst: jest.fn().mockResolvedValue({ sucursal_id: 'sucursal-1' }),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const service = new CajasService(prisma, realtime);

    const estado = await service.getEstadoCaja(
      'botica-1',
      'usuario-1',
      'sucursal-1',
    );

    // Debe haber ejecutado el cierre
    expect(caja.estado).toBe('CERRADA');
    expect(estado.estado).toBe('CERRADA');
    expect(realtime.notificarCajaCerrada).toHaveBeenCalledWith(
      'sucursal-1',
      'caja-1',
      expect.objectContaining({
        tipo_diferencia: 'EXACTO',
        observacion: 'Cierre automático por cambio de día (Sistema)',
      }),
    );
    expect(movimientos).toHaveLength(2);
    expect(movimientos[1].tipo).toBe('CIERRE');
    expect(movimientos[1].monto).toBe(100);
  });
});
