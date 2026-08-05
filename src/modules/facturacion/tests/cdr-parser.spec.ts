import AdmZip from 'adm-zip';
import { CdrParserService } from '../cdr/cdr-parser.service';
import { ZipService } from '../zip/zip.service';
import { EstadoComprobante } from '../domain/estado-comprobante.enum';

function cdrXml(codigo: string, descripcion: string, nota?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ResponseDate>2026-08-03</cbc:ResponseDate>
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ResponseCode>${codigo}</cbc:ResponseCode>
      <cbc:Description>${descripcion}</cbc:Description>
      ${nota ? `<cbc:Note>${nota}</cbc:Note>` : ''}
    </cac:Response>
    <cac:DocumentReference><cbc:ID>B001-1</cbc:ID></cac:DocumentReference>
  </cac:DocumentResponse>
</ar:ApplicationResponse>`;
}

function zipDe(xml: string, nombre = 'R-20123456789-03-B001-1.xml'): Buffer {
  const zip = new AdmZip();
  zip.addFile(nombre, Buffer.from(xml, 'utf8'));
  return zip.toBuffer();
}

describe('CdrParserService', () => {
  let service: CdrParserService;

  beforeEach(() => {
    service = new CdrParserService(new ZipService());
  });

  it('detecta comprobante aceptado (código 0)', () => {
    const r = service.parsear(
      zipDe(cdrXml('0', 'La Boleta numero B001-1, ha sido aceptada')),
    );
    expect(r.estado).toBe(EstadoComprobante.ACEPTADO);
    expect(r.codigoRespuesta).toBe('0');
    expect(r.descripcion).toContain('aceptada');
  });

  it('detecta aceptado con observaciones (0100-1999)', () => {
    const r = service.parsear(
      zipDe(cdrXml('1033', 'Aceptado con observaciones', 'Observación X')),
    );
    expect(r.estado).toBe(EstadoComprobante.ACEPTADO_CON_OBSERVACIONES);
    expect(r.observaciones).toContain('Observación X');
  });

  it('detecta rechazo (código >= 4000 u otro)', () => {
    const r = service.parsear(
      zipDe(cdrXml('2010', 'El documento ya fue informado')),
    );
    expect(r.estado).toBe(EstadoComprobante.RECHAZADO);
  });

  it('rechaza un ZIP corrupto', () => {
    expect(() => service.parsear(Buffer.from('esto no es zip'))).toThrow(
      'no es un ZIP válido',
    );
  });

  it('rechaza un ZIP con XML vacío', () => {
    expect(() => service.parsear(zipDe('   '))).toThrow('XML vacío');
  });

  it('rechaza un XML sin DocumentResponse', () => {
    expect(() => service.parsear(zipDe('<Otro></Otro>'))).toThrow(
      'DocumentResponse',
    );
  });

  it('rechaza una CDR sin ResponseCode', () => {
    const xml = cdrXml('', 'x').replace(
      '<cbc:ResponseCode></cbc:ResponseCode>',
      '',
    );
    expect(() => service.parsear(zipDe(xml))).toThrow('ResponseCode');
  });
});
