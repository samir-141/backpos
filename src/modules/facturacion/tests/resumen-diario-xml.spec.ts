import { ResumenDiarioXmlBuilder } from '../builders/resumen-diario-xml.builder';

describe('ResumenDiarioXmlBuilder', () => {
  let builder: ResumenDiarioXmlBuilder;

  beforeEach(() => {
    builder = new ResumenDiarioXmlBuilder();
  });

  it('genera SummaryDocuments con UBL 2.0 y CustomizationID 1.1', () => {
    const xml = builder.build({
      emisor: {
        ruc: '20123456789',
        razonSocial: 'BOTICA PRUEBA S.A.C.',
        direccion: 'AV. PRUEBA 123',
        codigoPais: 'PE',
      },
      identificador: 'RC-20260803-001',
      fechaReferencia: new Date('2026-08-03T00:00:00'),
      fechaGeneracion: new Date('2026-08-04T09:00:00'),
      lineas: [
        {
          tipoComprobante: '03',
          serie: 'B001',
          correlativo: 1,
          clienteTipoDocumento: '1',
          clienteNumeroDocumento: '72456189',
          moneda: 'PEN',
          total: 11.8,
          totalGravado: 10,
          totalExonerado: 0,
          totalInafecto: 0,
          totalIgv: 1.8,
          condicion: '1',
        },
      ],
    });

    expect(xml).toContain('SummaryDocuments');
    expect(xml).toContain('<cbc:UBLVersionID>2.0</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>1.1</cbc:CustomizationID>');
    expect(xml).toContain('<cbc:ID>RC-20260803-001</cbc:ID>');
    expect(xml).toContain('<cbc:ReferenceDate>2026-08-03</cbc:ReferenceDate>');
    expect(xml).toContain('<cbc:IssueDate>2026-08-04</cbc:IssueDate>');
    expect(xml).toContain('sac:SummaryDocumentsLine');
    expect(xml).toContain('<cbc:DocumentTypeCode>03</cbc:DocumentTypeCode>');
    expect(xml).toContain('<cbc:ID>B001-1</cbc:ID>');
    expect(xml).toContain('<cbc:ConditionCode>1</cbc:ConditionCode>');
    expect(xml).toContain('>11.80<');
    expect(xml).toContain('20123456789');
  });
});
