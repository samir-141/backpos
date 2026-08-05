import { ProductosService } from './productos.service';

const BOTICA_ID = 'botica-1';
const USUARIO_ID = 'usuario-1';

const dtoBase = {
  tipo_producto: 'OTRO' as const,
  nombre_comercial: 'Producto de prueba',
  sku: 'SKU-TEST',
  categoria_id: 'categoria-1',
  presentacion_id: 'unidad-1',
  unidad_base_id: 'unidad-1',
  cantidad_unidad_base: 1,
  precio_actual: 10,
};

function fixture(options?: { codigoInternoManual?: string }) {
  const created = {
    productoComercialId: 'producto-1',
    presentacionId: 'presentacion-1',
  };

  const productoComercialCreate = jest.fn().mockReturnValue({
    id: created.productoComercialId,
  });
  const presentacionCreate = jest.fn().mockReturnValue({
    id: created.presentacionId,
    unidad_presentacion_id: 'unidad-1',
  });
  const correlativosUpsert = jest.fn().mockReturnValue({ ultimo_numero: 1 });

  const tx = {
    categorias: {
      findFirst: jest.fn().mockResolvedValue({ id: 'categoria-1' }),
    },
    unidades_presentacion: {
      findFirst: jest.fn().mockResolvedValue({ id: 'unidad-1' }),
    },
    correlativos: { upsert: correlativosUpsert },
    productos_comerciales: { create: productoComercialCreate },
    productos_presentaciones: { create: presentacionCreate },
  };

  const prismaMock = {
    productos_comerciales: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    productos_presentaciones: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(async (work: (t: typeof tx) => Promise<unknown>) => {
      return await work(tx);
    }),
  };

  const service = new ProductosService(
    prismaMock as unknown as any,
    {
      notificarStockActualizado: jest.fn(),
      notificarGeneral: jest.fn(),
    } as unknown as any,
  );

  return {
    service,
    prismaMock,
    tx,
    productoComercialCreate,
    correlativosUpsert,
  };
}

describe('ProductosService generación de código interno', () => {
  it('genera PRD-000001 cuando no se envía código interno', async () => {
    const f = fixture();

    await f.service.create(BOTICA_ID, dtoBase, USUARIO_ID);

    expect(f.correlativosUpsert).toHaveBeenCalledTimes(1);
    expect(f.productoComercialCreate).toHaveBeenCalledTimes(1);
    expect(f.productoComercialCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigo_interno: 'PRD-000001',
        }),
      }),
    );
  });

  it('conserva el código interno manual y no toca correlativos', async () => {
    const f = fixture();

    await f.service.create(
      BOTICA_ID,
      { ...dtoBase, codigo_interno: 'INT-001' },
      USUARIO_ID,
    );

    expect(f.correlativosUpsert).not.toHaveBeenCalled();
    expect(f.productoComercialCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codigo_interno: 'INT-001',
        }),
      }),
    );
  });
});
