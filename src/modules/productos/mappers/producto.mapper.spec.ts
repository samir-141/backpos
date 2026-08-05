import { ProductoMapper, ProductoDetalleEntrada } from './producto.mapper';

const productoBase = (createdAt: Date | null): ProductoDetalleEntrada => ({
  id: 'producto-1',
  sku: 'SKU-001',
  nombre_comercial: 'Producto de prueba',
  registro_sanitario: null,
  codigo_interno: null,
  estado: 'ACTIVO',
  created_at: createdAt,
  controla_lote: false,
  requiere_vencimiento: false,
  categorias: { id: 'categoria-1', nombre: 'Otros' },
  unidades_presentacion: {
    id: 'unidad-1',
    nombre: 'Unidad',
    abreviatura: 'und',
  },
});

describe('ProductoMapper', () => {
  it('conserva created_at nulo cuando la base de datos no tiene fecha', () => {
    const resultado = ProductoMapper.toDetalleResponse(productoBase(null));

    expect(resultado.created_at).toBeNull();
  });

  it('conserva created_at cuando existe', () => {
    const createdAt = new Date('2026-08-01T12:00:00.000Z');

    const resultado = ProductoMapper.toDetalleResponse(productoBase(createdAt));

    expect(resultado.created_at).toBe(createdAt);
  });
});
