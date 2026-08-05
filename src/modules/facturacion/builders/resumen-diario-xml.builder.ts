import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { EmisorData } from '../domain/comprobante-data.interface';

export interface LineaResumenDiario {
  tipoComprobante: string; // '03' boleta (o '07'/'08' de boletas)
  serie: string;
  correlativo: number;
  clienteTipoDocumento: string;
  clienteNumeroDocumento: string;
  moneda: string;
  total: number;
  totalGravado: number;
  totalExonerado: number;
  totalInafecto: number;
  totalIgv: number;
  /** '1' = adicionar, '2' = modificar, '3' = anular */
  condicion: string;
}

export interface DatosResumenDiario {
  emisor: EmisorData;
  /** Identificador RC-YYYYMMDD- correlativo. */
  identificador: string;
  fechaReferencia: Date;
  fechaGeneracion: Date;
  lineas: LineaResumenDiario[];
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function fmtFecha(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * XML UBL del Resumen Diario (SummaryDocuments) para boletas.
 * Nota SUNAT: este documento usa UBLVersionID 2.0 / CustomizationID 1.1.
 */
@Injectable()
export class ResumenDiarioXmlBuilder {
  build(datos: DatosResumenDiario): string {
    const root = create({
      version: '1.0',
      encoding: 'UTF-8',
      standalone: false,
    }).ele('SummaryDocuments', {
      xmlns:
        'urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1',
      'xmlns:cac':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      'xmlns:ext':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      'xmlns:sac':
        'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
    });

    root
      .ele('ext:UBLExtensions')
      .ele('ext:UBLExtension')
      .ele('ext:ExtensionContent')
      .up()
      .up()
      .up();

    root.ele('cbc:UBLVersionID').txt('2.0').up();
    root.ele('cbc:CustomizationID').txt('1.1').up();
    root.ele('cbc:ID').txt(datos.identificador).up();
    root.ele('cbc:ReferenceDate').txt(fmtFecha(datos.fechaReferencia)).up();
    root.ele('cbc:IssueDate').txt(fmtFecha(datos.fechaGeneracion)).up();

    root
      .ele('cac:Signature')
      .ele('cbc:ID')
      .txt('SignatureSP')
      .up()
      .ele('cac:SignatoryParty')
      .ele('cac:PartyIdentification')
      .ele('cbc:ID')
      .txt(datos.emisor.ruc)
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

    root
      .ele('cac:AccountingSupplierParty')
      .ele('cbc:CustomerAssignedAccountID')
      .txt(datos.emisor.ruc)
      .up()
      .ele('cbc:AdditionalAccountID')
      .txt('6')
      .up()
      .ele('cac:Party')
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName')
      .txt(datos.emisor.razonSocial)
      .up()
      .up()
      .up()
      .up();

    datos.lineas.forEach((linea, index) => {
      const nodo = root.ele('sac:SummaryDocumentsLine');
      nodo
        .ele('cbc:LineID')
        .txt(String(index + 1))
        .up()
        .ele('cbc:DocumentTypeCode')
        .txt(linea.tipoComprobante)
        .up()
        .ele('cbc:ID')
        .txt(`${linea.serie}-${linea.correlativo}`)
        .up()
        .ele('cac:AccountingCustomerParty')
        .ele('cbc:CustomerAssignedAccountID')
        .txt(linea.clienteNumeroDocumento)
        .up()
        .ele('cbc:AdditionalAccountID')
        .txt(linea.clienteTipoDocumento)
        .up()
        .up()
        .ele('cac:Status')
        .ele('cbc:ConditionCode')
        .txt(linea.condicion)
        .up()
        .up()
        .ele('sac:TotalAmount', { currencyID: linea.moneda })
        .txt(fmt(linea.total))
        .up();

      if (linea.totalGravado > 0) {
        nodo
          .ele('sac:BillingPayment')
          .ele('cbc:PaidAmount', { currencyID: linea.moneda })
          .txt(fmt(linea.totalGravado))
          .up()
          .ele('cbc:InstructionID', { schemeID: '01' })
          .txt('01')
          .up()
          .up();
      }
      if (linea.totalExonerado > 0) {
        nodo
          .ele('sac:BillingPayment')
          .ele('cbc:PaidAmount', { currencyID: linea.moneda })
          .txt(fmt(linea.totalExonerado))
          .up()
          .ele('cbc:InstructionID', { schemeID: '02' })
          .txt('02')
          .up()
          .up();
      }
      if (linea.totalInafecto > 0) {
        nodo
          .ele('sac:BillingPayment')
          .ele('cbc:PaidAmount', { currencyID: linea.moneda })
          .txt(fmt(linea.totalInafecto))
          .up()
          .ele('cbc:InstructionID', { schemeID: '03' })
          .txt('03')
          .up()
          .up();
      }

      nodo
        .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: linea.moneda })
        .txt(fmt(linea.totalIgv))
        .up()
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxAmount', { currencyID: linea.moneda })
        .txt(fmt(linea.totalIgv))
        .up()
        .ele('cac:TaxCategory')
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt('1000')
        .up()
        .ele('cbc:Name')
        .txt('IGV')
        .up()
        .ele('cbc:TaxTypeCode')
        .txt('VAT')
        .up()
        .up()
        .up()
        .up()
        .up();
    });

    return root.end({ prettyPrint: true });
  }
}
