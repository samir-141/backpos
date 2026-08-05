import {
  createCorsOptions,
  isCorsOriginAllowed,
  parseCorsOrigins,
} from './cors.config';

describe('configuración CORS', () => {
  const production = {
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://pos.example.com,https://admin.example.com',
  };

  it('permite únicamente orígenes configurados en producción', () => {
    expect(isCorsOriginAllowed('https://pos.example.com', production)).toBe(
      true,
    );
    expect(isCorsOriginAllowed('https://malicioso.example', production)).toBe(
      false,
    );
  });

  it('permite localhost y redes privadas solamente en desarrollo', () => {
    const lanOrigin = 'http://192.168.0.4:5173';
    expect(isCorsOriginAllowed(lanOrigin, { NODE_ENV: 'development' })).toBe(
      true,
    );
    expect(
      isCorsOriginAllowed('http://[::1]:5173', { NODE_ENV: 'development' }),
    ).toBe(true);
    expect(isCorsOriginAllowed(lanOrigin, { NODE_ENV: 'production' })).toBe(
      false,
    );
  });

  it('permite solicitudes sin Origin para clientes no navegador', () => {
    expect(isCorsOriginAllowed(undefined, production)).toBe(true);
  });

  it('rechaza comodines y entradas que no sean orígenes', () => {
    expect(() => parseCorsOrigins('*')).toThrow('"*" no está permitido');
    expect(() => parseCorsOrigins('https://pos.example.com/ruta')).toThrow(
      'Origen CORS inválido',
    );
  });

  it('entrega el mismo verificador a HTTP y Socket.IO', () => {
    const options = createCorsOptions(production);
    const origin = options.origin;
    if (typeof origin !== 'function') {
      throw new Error(
        'La política debe usar un verificador dinámico de origen.',
      );
    }

    const allowed = jest.fn();
    origin('https://admin.example.com', allowed);
    expect(allowed).toHaveBeenCalledWith(null, true);

    const rejected = jest.fn();
    origin('https://malicioso.example', rejected);
    expect(rejected).toHaveBeenCalledWith(expect.any(Error), false);
  });
});
