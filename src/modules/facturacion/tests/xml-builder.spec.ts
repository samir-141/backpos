import { XmlBuilderService } from '../builders/xml-builder.service';
import { ComprobanteSunatData } from '../domain/comprobante-data.interface';

export function dataDePrueba(): ComprobanteSunatData {
  return {
    emisor: {
      ruc: '20123456789',
      razonSocial: 'BOTICA PRUEBA S.A.C.',
      nombreComercial: 'BOTICA PRUEBA',
      ubigeo: '150101',
      direccion: 'AV. PRUEBA 123',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'LIMA',
      codigoPais: 'PE',
    },
    cliente: {
      tipoDocumento: '1',
      numeroDocumento: '72456189',
      razonSocial: 'JUAN PEREZ',
      direccion: 'JR. CLIENTE 456',
    },
    documento: {
      tipoComprobante: '03',
      serie: 'B001',
      correlativo: 1,
      fechaEmision: new Date('2026-08-03T10:30:00'),
      moneda: 'PEN',
      formaPago: 'CONTADO',
    },
    items: [
      {
        codigoProducto: 'P001',
        descripcion: 'PARACETAMOL 500MG X 10',
        unidadMedida: 'NIU',
        cantidad: 1,
        valorUnitario: 10,
        precioUnitario: 11.8,
        valorVenta: 10,
        descuento: 0,
        codigoAfectacionIgv: '10',
        porcentajeIgv: 18,
        montoIgv: 1.8,
        importeTotal: 11.8,
      },
    ],
    totales: {
      totalGravado: 10,
      totalExonerado: 0,
      totalInafecto: 0,
      totalGratuito: 0,
      totalDescuentos: 0,
      totalIgv: 1.8,
      subtotal: 10,
      total: 11.8,
      montoEnLetras: 'ONCE CON 80/100 SOLES',
    },
  };
}

describe('XmlBuilderService', () => {
  let service: XmlBuilderService;

  beforeEach(() => {
    service = new XmlBuilderService();
  });

  it('genera UBL 2.1 con los nodos obligatorios de SUNAT', () => {
    const xml = service.buildInvoice(dataDePrueba());

    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>2.0</cbc:CustomizationID>');
    expect(xml).toContain('<cbc:ID>B001-1</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2026-08-03</cbc:IssueDate>');
    expect(xml).toContain('ext:UBLExtensions');
    expect(xml).toContain('ext:ExtensionContent');
    expect(xml).toContain('cac:Signature');
    expect(xml).toContain('#SignatureSP');
  });

  it('incluye los datos reales del emisor y del cliente', () => {
    const xml = service.buildInvoice(dataDePrueba());
    expect(xml).toContain('20123456789');
    expect(xml).toContain('BOTICA PRUEBA S.A.C.');
    expect(xml).toContain('72456189');
    expect(xml).toContain('JUAN PEREZ');
  });

  it('incluye el monto en letras y la moneda', () => {
    const xml = service.buildInvoice(dataDePrueba());
    expect(xml).toContain('ONCE CON 80/100 SOLES');
    expect(xml).toContain('<cbc:DocumentCurrencyCode');
    expect(xml).toContain('>PEN<');
  });

  it('declara los totales tributarios correctos', () => {
    const xml = service.buildInvoice(dataDePrueba());
    expect(xml).toContain(
      '<cbc:TaxAmount currencyID="PEN">1.80</cbc:TaxAmount>',
    );
    expect(xml).toContain(
      '<cbc:PayableAmount currencyID="PEN">11.80</cbc:PayableAmount>',
    );
    expect(xml).toContain('<cbc:Percent>18</cbc:Percent>');
    expect(xml).toContain('>1000<'); // IGV catálogo 05
  });

  it('usa esquema EXO para líneas exoneradas', () => {
    const data = dataDePrueba();
    data.items[0].codigoAfectacionIgv = '20';
    data.items[0].porcentajeIgv = 0;
    data.items[0].montoIgv = 0;
    data.totales.totalGravado = 0;
    data.totales.totalExonerado = 10;
    data.totales.totalIgv = 0;
    const xml = service.buildInvoice(data);
    expect(xml).toContain('>9002<'); // EXO catálogo 05
    expect(xml).toContain('>EXO<');
  });

  it('soporta solo factura y boleta en este builder', () => {
    expect(service.soporta('01')).toBe(true);
    expect(service.soporta('03')).toBe(true);
    expect(service.soporta('07')).toBe(false);
  });
});
