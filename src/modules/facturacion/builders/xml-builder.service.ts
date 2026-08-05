import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import {
  ComprobanteSunatData,
  ComprobanteItemData,
} from '../domain/comprobante-data.interface';
import { TipoDocumentoSunat, TipoTributo } from '../sunat/catalogos.enum';

const NS = {
  invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ccts: 'urn:un:unece:uncefact:documentation:2',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  qdt: 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
  udt: 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
};

function esGravado(item: ComprobanteItemData): boolean {
  return item.codigoAfectacionIgv.startsWith('1');
}
function esExonerado(item: ComprobanteItemData): boolean {
  return item.codigoAfectacionIgv.startsWith('2');
}

function esquemaTributario(item: ComprobanteItemData): {
  id: string;
  nombre: string;
  codigo: string;
} {
  if (esGravado(item)) {
    return { id: TipoTributo.IGV, nombre: 'IGV', codigo: 'VAT' };
  }
  if (esExonerado(item)) {
    return { id: TipoTributo.EXO, nombre: 'EXO', codigo: 'VAT' };
  }
  return { id: TipoTributo.INA, nombre: 'INA', codigo: 'FRE' };
}

function fmt(valor: number): string {
  return valor.toFixed(2);
}

function fmtFecha(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtHora(fecha: Date): string {
  return [fecha.getHours(), fecha.getMinutes(), fecha.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

/**
 * Generador de XML UBL 2.1 para boletas (03) y facturas (01).
 * El placeholder `ds:Signature` se reemplaza al firmar (FirmaService).
 */
@Injectable()
export class XmlBuilderService {
  buildInvoice(data: ComprobanteSunatData): string {
    const { emisor, cliente, documento, items, totales } = data;
    const moneda = documento.moneda;

    const root = create({
      version: '1.0',
      encoding: 'UTF-8',
      standalone: false,
    }).ele('Invoice', {
      xmlns: NS.invoice,
      'xmlns:cac': NS.cac,
      'xmlns:cbc': NS.cbc,
      'xmlns:ccts': NS.ccts,
      'xmlns:ds': NS.ds,
      'xmlns:ext': NS.ext,
      'xmlns:qdt': NS.qdt,
      'xmlns:udt': NS.udt,
      'xmlns:xsi': NS.xsi,
    });

    // Extensión donde FirmaService insertará la firma digital
    root
      .ele('ext:UBLExtensions')
      .ele('ext:UBLExtension')
      .ele('ext:ExtensionContent')
      .up()
      .up()
      .up();

    root.ele('cbc:UBLVersionID').txt('2.1').up();
    root.ele('cbc:CustomizationID').txt('2.0').up();
    root.ele('cbc:ID').txt(`${documento.serie}-${documento.correlativo}`).up();
    root.ele('cbc:IssueDate').txt(fmtFecha(documento.fechaEmision)).up();
    root.ele('cbc:IssueTime').txt(fmtHora(documento.fechaEmision)).up();
    root
      .ele('cbc:InvoiceTypeCode', {
        listAgencyName: 'PE:SUNAT',
        listName: 'Tipo de Documento',
        listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01',
        listID: '0101',
      })
      .txt(documento.tipoComprobante)
      .up();
    root
      .ele('cbc:Note', { languageLocaleID: '1000' })
      .txt(totales.montoEnLetras)
      .up();
    root
      .ele('cbc:DocumentCurrencyCode', {
        listID: 'ISO 4217 Alpha',
        listName: 'Currency',
        listAgencyName: 'United Nations Economic Commission for Europe',
      })
      .txt(moneda)
      .up();

    // Referencia a la firma digital
    root
      .ele('cac:Signature')
      .ele('cbc:ID')
      .txt('SignatureSP')
      .up()
      .ele('cac:SignatoryParty')
      .ele('cac:PartyIdentification')
      .ele('cbc:ID')
      .txt(emisor.ruc)
      .up()
      .up()
      .up()
      .ele('cac:DigitalSignatureAttachment')
      .ele('cac:ExternalReference')
      .ele('cbc:URI')
      .txt('#SignatureSP')
      .up()
      .up()
      .up()
      .up();

    // Emisor
    const supplierParty = root
      .ele('cac:AccountingSupplierParty')
      .ele('cac:Party');
    supplierParty
      .ele('cac:PartyIdentification')
      .ele('cbc:ID', {
        schemeID: '6',
        schemeName: 'Documento de Identidad',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
      })
      .txt(emisor.ruc)
      .up()
      .up();
    if (emisor.nombreComercial) {
      supplierParty
        .ele('cac:PartyName')
        .ele('cbc:Name')
        .txt(emisor.nombreComercial)
        .up()
        .up();
    }
    const legalEntity = supplierParty
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName')
      .txt(emisor.razonSocial)
      .up()
      .ele('cac:RegistrationAddress');
    if (emisor.ubigeo) {
      legalEntity
        .ele('cbc:ID', {
          schemeName: 'Ubigeos',
          schemeAgencyName: 'PE:INEI',
        })
        .txt(emisor.ubigeo)
        .up();
    }
    legalEntity
      .ele('cbc:AddressTypeCode', {
        listAgencyName: 'PE:SUNAT',
        listName: 'Establecimientos anexos',
      })
      .txt('0000')
      .up();
    if (emisor.departamento) {
      legalEntity.ele('cbc:CityName').txt(emisor.departamento).up();
    }
    if (emisor.provincia) {
      legalEntity.ele('cbc:CountrySubentity').txt(emisor.provincia).up();
    }
    if (emisor.distrito) {
      legalEntity.ele('cbc:District').txt(emisor.distrito).up();
    }
    legalEntity
      .ele('cac:AddressLine')
      .ele('cbc:Line')
      .txt(emisor.direccion)
      .up()
      .up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode', {
        listID: 'ISO 3166-1',
        listAgencyName: 'United Nations Economic Commission for Europe',
        listName: 'Country',
      })
      .txt(emisor.codigoPais)
      .up()
      .up();

    // Adquiriente (cliente)
    const customerParty = root
      .ele('cac:AccountingCustomerParty')
      .ele('cac:Party');
    customerParty
      .ele('cac:PartyIdentification')
      .ele('cbc:ID', {
        schemeID: cliente.tipoDocumento,
        schemeName: 'Documento de Identidad',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
      })
      .txt(cliente.numeroDocumento)
      .up()
      .up();
    const customerLegal = customerParty
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName')
      .txt(cliente.razonSocial)
      .up();
    if (cliente.direccion) {
      customerLegal
        .ele('cac:RegistrationAddress')
        .ele('cac:AddressLine')
        .ele('cbc:Line')
        .txt(cliente.direccion)
        .up()
        .up()
        .up();
    }

    // Forma de pago
    root
      .ele('cac:PaymentTerms')
      .ele('cbc:ID')
      .txt('FormaPago')
      .up()
      .ele('cbc:PaymentMeansID')
      .txt(documento.formaPago === 'CREDITO' ? 'Credito' : 'Contado')
      .up()
      .up();

    // Totales de tributos (subtotal por cada esquema presente)
    const taxTotal = root
      .ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: moneda })
      .txt(fmt(totales.totalIgv))
      .up();

    const agregarSubtotal = (
      base: number,
      impuesto: number,
      esquema: { id: string; nombre: string; codigo: string },
    ) => {
      taxTotal
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: moneda })
        .txt(fmt(base))
        .up()
        .ele('cbc:TaxAmount', { currencyID: moneda })
        .txt(fmt(impuesto))
        .up()
        .ele('cac:TaxCategory')
        .ele('cac:TaxScheme')
        .ele('cbc:ID', {
          schemeName: 'Codigo de tributos',
          schemeAgencyName: 'PE:SUNAT',
          schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05',
        })
        .txt(esquema.id)
        .up()
        .ele('cbc:Name')
        .txt(esquema.nombre)
        .up()
        .ele('cbc:TaxTypeCode')
        .txt(esquema.codigo)
        .up()
        .up()
        .up()
        .up();
    };

    if (totales.totalGravado > 0) {
      agregarSubtotal(totales.totalGravado, totales.totalIgv, {
        id: TipoTributo.IGV,
        nombre: 'IGV',
        codigo: 'VAT',
      });
    }
    if (totales.totalExonerado > 0) {
      agregarSubtotal(totales.totalExonerado, 0, {
        id: TipoTributo.EXO,
        nombre: 'EXO',
        codigo: 'VAT',
      });
    }
    if (totales.totalInafecto > 0) {
      agregarSubtotal(totales.totalInafecto, 0, {
        id: TipoTributo.INA,
        nombre: 'INA',
        codigo: 'FRE',
      });
    }
    taxTotal.up();

    // Totales monetarios
    const legal = root.ele('cac:LegalMonetaryTotal');
    legal
      .ele('cbc:LineExtensionAmount', { currencyID: moneda })
      .txt(fmt(totales.subtotal))
      .up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: moneda })
      .txt(fmt(totales.total))
      .up();
    if (totales.totalDescuentos > 0) {
      legal
        .ele('cbc:AllowanceTotalAmount', { currencyID: moneda })
        .txt(fmt(totales.totalDescuentos))
        .up();
    }
    legal
      .ele('cbc:PayableAmount', { currencyID: moneda })
      .txt(fmt(totales.total))
      .up()
      .up();

    // Líneas
    items.forEach((item, index) => {
      const esquema = esquemaTributario(item);
      const linea = root.ele('cac:InvoiceLine');
      linea
        .ele('cbc:ID')
        .txt(String(index + 1))
        .up()
        .ele('cbc:InvoicedQuantity', {
          unitCode: item.unidadMedida,
          unitCodeListID: 'UN/ECE rec 20',
          unitCodeListAgencyName:
            'United Nations Economic Commission for Europe',
        })
        .txt(String(item.cantidad))
        .up()
        .ele('cbc:LineExtensionAmount', { currencyID: moneda })
        .txt(fmt(item.valorVenta))
        .up();

      linea
        .ele('cac:PricingReference')
        .ele('cac:AlternativeConditionPrice')
        .ele('cbc:PriceAmount', { currencyID: moneda })
        .txt(
          item.precioUnitario
            .toFixed(6)
            .replace(/0+$/, '')
            .replace(/\.$/, '.0'),
        )
        .up()
        .ele('cbc:PriceTypeCode', {
          listName: 'Tipo de Precio',
          listAgencyName: 'PE:SUNAT',
          listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16',
        })
        .txt('01')
        .up()
        .up()
        .up();

      linea
        .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: moneda })
        .txt(fmt(item.montoIgv))
        .up()
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: moneda })
        .txt(fmt(item.valorVenta))
        .up()
        .ele('cbc:TaxAmount', { currencyID: moneda })
        .txt(fmt(item.montoIgv))
        .up()
        .ele('cac:TaxCategory')
        .ele('cbc:Percent')
        .txt(String(item.porcentajeIgv))
        .up()
        .ele('cbc:TaxExemptionReasonCode', {
          listAgencyName: 'PE:SUNAT',
          listName: 'Afectacion del IGV',
          listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07',
        })
        .txt(item.codigoAfectacionIgv)
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID', {
          schemeName: 'Codigo de tributos',
          schemeAgencyName: 'PE:SUNAT',
          schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05',
        })
        .txt(esquema.id)
        .up()
        .ele('cbc:Name')
        .txt(esquema.nombre)
        .up()
        .ele('cbc:TaxTypeCode')
        .txt(esquema.codigo)
        .up()
        .up()
        .up()
        .up()
        .up();

      const itemNode = linea
        .ele('cac:Item')
        .ele('cbc:Description')
        .txt(item.descripcion)
        .up();
      if (item.codigoProducto) {
        itemNode
          .ele('cac:SellersItemIdentification')
          .ele('cbc:ID')
          .txt(item.codigoProducto)
          .up()
          .up();
      }
      itemNode.up();

      linea
        .ele('cac:Price')
        .ele('cbc:PriceAmount', { currencyID: moneda })
        .txt(
          item.valorUnitario.toFixed(6).replace(/0+$/, '').replace(/\.$/, '.0'),
        )
        .up()
        .up();
    });

    return root.end({ prettyPrint: true });
  }

  /** Nombre lógico del documento (Invoice aplica a factura 01 y boleta 03). */
  soporta(tipoComprobante: string): boolean {
    return [TipoDocumentoSunat.FACTURA, TipoDocumentoSunat.BOLETA].includes(
      tipoComprobante as TipoDocumentoSunat,
    );
  }
}
