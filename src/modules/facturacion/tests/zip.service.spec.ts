import AdmZip from 'adm-zip';
import { ZipService } from '../zip/zip.service';

describe('ZipService', () => {
  let service: ZipService;

  beforeEach(() => {
    service = new ZipService();
  });

  it('genera un ZIP con un único XML de nombre correcto', () => {
    const nombre = '20123456789-03-B001-1';
    const buffer = service.comprimirXml(nombre, '<Invoice>ok</Invoice>');

    const zip = new AdmZip(buffer);
    const entradas = zip.getEntries();
    expect(entradas).toHaveLength(1);
    expect(entradas[0].entryName).toBe(`${nombre}.xml`);
    expect(entradas[0].getData().toString('utf8')).toBe(
      '<Invoice>ok</Invoice>',
    );
  });

  it('extrae el primer archivo de un ZIP', () => {
    const buffer = service.comprimirXml('X-03-B001-9', '<a/>');
    const extraido = service.extraerPrimero(buffer);
    expect(extraido.nombre).toBe('X-03-B001-9.xml');
    expect(extraido.contenido.toString('utf8')).toBe('<a/>');
  });

  it('falla con un ZIP corrupto', () => {
    expect(() => service.extraerPrimero(Buffer.from('nope'))).toThrow();
  });
});
