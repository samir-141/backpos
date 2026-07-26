import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { CreateInvoiceDto } from '../dtos/create-invoice.dto';
import { TipoDocumentoSunat, TipoTributo } from '../sunat/catalogos.enum';

@Injectable()
export class XmlBuilderService {
  buildInvoice(dto: CreateInvoiceDto): string {
    const isFactura = dto.tipoDocumento === TipoDocumentoSunat.FACTURA;
    
    // Configuración base de UBL 2.1 para Factura o Boleta
    const root = create({ version: '1.0', encoding: 'UTF-8', standalone: false })
      .ele('Invoice', {
        'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ccts': 'urn:un:unece:uncefact:documentation:2',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'xmlns:qdt': 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
        'xmlns:udt': 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2',
      });

    // Extensiones para la firma
    const ext = root.ele('ext:UBLExtensions')
      .ele('ext:UBLExtension')
        .ele('ext:ExtensionContent');
    
    // Aquí se inyectará la firma posteriormente
    ext.ele('ds:Signature', { Id: 'SignatureSP' }).up().up().up();

    root.ele('cbc:UBLVersionID').txt('2.1').up();
    root.ele('cbc:CustomizationID').txt('2.0').up();
    root.ele('cbc:ID').txt(`${dto.serie}-${dto.correlativo}`).up();
    root.ele('cbc:IssueDate').txt(dto.fechaEmision.split('T')[0]).up();
    root.ele('cbc:IssueTime').txt(dto.fechaEmision.split('T')[1]?.substring(0, 8) || '00:00:00').up();
    root.ele('cbc:InvoiceTypeCode', { listID: '0101', name: '0101', listAgencyName: 'PE:SUNAT', listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01' }).txt(dto.tipoDocumento).up();
    
    // TODO: Add Note for amounts in letters
    // root.ele('cbc:Note', { languageLocaleID: '1000' }).txt('CATORCE MIL Y 00/100 SOLES').up();
    
    root.ele('cbc:DocumentCurrencyCode', { listID: 'ISO 4217 Alpha', listName: 'Currency', listAgencyName: 'United Nations Economic Commission for Europe' }).txt(dto.moneda).up();
    
    // Emisor (Datos quemados por ahora, luego deben venir de la configuración)
    const supplier = root.ele('cac:AccountingSupplierParty')
      .ele('cac:Party')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID', { schemeID: '6', schemeName: 'Documento de Identidad', schemeAgencyName: 'PE:SUNAT', schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06' }).txt('20000000001').up()
        .up()
        .ele('cac:PartyName')
          .ele('cbc:Name').txt('FARMACIA DEMO S.A.C.').up()
        .up()
        .ele('cac:PartyLegalEntity')
          .ele('cbc:RegistrationName').txt('FARMACIA DEMO S.A.C.').up()
          .ele('cac:RegistrationAddress')
            .ele('cbc:ID').txt('150101').up() // Ubigeo
            .ele('cbc:AddressTypeCode').txt('0000').up() // Cod local
            .ele('cac:AddressLine')
              .ele('cbc:Line').txt('AV. DEMO 123').up()
            .up()
            .ele('cac:Country')
              .ele('cbc:IdentificationCode').txt('PE').up()
            .up()
          .up()
        .up();
    supplier.up().up();

    // Adquiriente (Cliente)
    const customer = root.ele('cac:AccountingCustomerParty')
      .ele('cac:Party')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID', { schemeID: dto.cliente.tipoDocumento, schemeName: 'Documento de Identidad', schemeAgencyName: 'PE:SUNAT', schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06' }).txt(dto.cliente.numeroDocumento).up()
        .up()
        .ele('cac:PartyLegalEntity')
          .ele('cbc:RegistrationName').txt(dto.cliente.razonSocial).up();
          
    if (dto.cliente.direccion) {
      // Opcional para boletas menores a 700, obligatorio facturas
      // customer.ele('cac:RegistrationAddress')...
    }
    customer.up().up().up();

    // Total IGV
    const taxTotal = root.ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: dto.moneda }).txt(dto.totalIgv.toFixed(2)).up()
      .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: dto.moneda }).txt(dto.totalGravadas.toFixed(2)).up()
        .ele('cbc:TaxAmount', { currencyID: dto.moneda }).txt(dto.totalIgv.toFixed(2)).up()
        .ele('cac:TaxCategory')
          .ele('cac:TaxScheme')
            .ele('cbc:ID', { schemeID: 'UN/ECE 5153', schemeAgencyID: '6' }).txt(TipoTributo.IGV).up()
            .ele('cbc:Name').txt('IGV').up()
            .ele('cbc:TaxTypeCode').txt('VAT').up()
          .up()
        .up()
      .up();
    taxTotal.up();

    // Importes Totales
    root.ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: dto.moneda }).txt(dto.totalGravadas.toFixed(2)).up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: dto.moneda }).txt(dto.importeTotal.toFixed(2)).up()
      .ele('cbc:PayableAmount', { currencyID: dto.moneda }).txt(dto.importeTotal.toFixed(2)).up()
    .up();

    // Items
    dto.items.forEach((item, index) => {
      const invoiceLine = root.ele('cac:InvoiceLine')
        .ele('cbc:ID').txt((index + 1).toString()).up()
        .ele('cbc:InvoicedQuantity', { unitCode: item.unidadMedida }).txt(item.cantidad.toString()).up()
        .ele('cbc:LineExtensionAmount', { currencyID: dto.moneda }).txt(item.subtotal.toFixed(2)).up()
        
        .ele('cac:PricingReference')
          .ele('cac:AlternativeConditionPrice')
            .ele('cbc:PriceAmount', { currencyID: dto.moneda }).txt(item.precioUnitario.toFixed(2)).up()
            .ele('cbc:PriceTypeCode').txt('01').up() // 01 = Precio Unitario (Incluye IGV)
          .up()
        .up()

        .ele('cac:TaxTotal')
          .ele('cbc:TaxAmount', { currencyID: dto.moneda }).txt(item.igv.toFixed(2)).up()
          .ele('cac:TaxSubtotal')
            .ele('cbc:TaxableAmount', { currencyID: dto.moneda }).txt(item.subtotal.toFixed(2)).up()
            .ele('cbc:TaxAmount', { currencyID: dto.moneda }).txt(item.igv.toFixed(2)).up()
            .ele('cac:TaxCategory')
              .ele('cbc:Percent').txt('18').up()
              .ele('cbc:TaxExemptionReasonCode').txt(item.tipoAfectacionIgv).up()
              .ele('cac:TaxScheme')
                .ele('cbc:ID').txt(TipoTributo.IGV).up()
                .ele('cbc:Name').txt('IGV').up()
                .ele('cbc:TaxTypeCode').txt('VAT').up()
              .up()
            .up()
          .up()
        .up()
        
        .ele('cac:Item')
          .ele('cbc:Description').txt(item.descripcion).up()
          .ele('cac:SellersItemIdentification')
            .ele('cbc:ID').txt(item.codigoProducto).up()
          .up()
        .up()
        
        .ele('cac:Price')
          .ele('cbc:PriceAmount', { currencyID: dto.moneda }).txt(item.valorUnitario.toFixed(2)).up()
        .up();
      
      invoiceLine.up();
    });

    return root.end({ prettyPrint: true });
  }

  buildCreditNote(payload: any): string {
    // Implementar construcción de XML UBL 2.1 para Notas de Crédito
    return '<CreditNote>...</CreditNote>';
  }
}
