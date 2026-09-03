import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('construye la ruta canónica aislada por botica_id correctamente', () => {
    const rutaLogo = service.construirRuta(
      'botica-123',
      'logos',
      'mi-logo.png',
    );
    expect(rutaLogo).toBe('botica-123/logos/mi-logo.png');

    const rutaXml = service.construirRuta(
      'botica-999',
      'comprobantes',
      'B001-1.xml',
      'xml',
    );
    expect(rutaXml).toBe('botica-999/comprobantes/xml/B001-1.xml');
  });

  it('sanitiza caracteres especiales en los nombres de archivo', () => {
    const ruta = service.construirRuta(
      'botica-abc',
      'recetas',
      'receta #1 / Dr. Pérez.jpg',
    );
    expect(ruta).toBe('botica-abc/recetas/receta__1___Dr._P_rez.jpg');
  });

  it('retorna error amigable en probarConexion si faltan variables de entorno', async () => {
    const resultado = await service.probarConexion();
    expect(resultado).toBeDefined();
    expect(typeof resultado.ok).toBe('boolean');
    expect(resultado.mensaje).toBeDefined();
  });
});
