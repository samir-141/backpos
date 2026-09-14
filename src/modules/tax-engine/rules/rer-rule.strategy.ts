import { Injectable } from '@nestjs/common';
import {
  DocumentTypeOption,
  TaxRuleContext,
  TaxRuleEvaluation,
  TaxRuleStrategy,
} from '../interfaces/tax-rule-strategy.interface';

@Injectable()
export class RerRuleStrategy implements TaxRuleStrategy {
  supports(regimen: string): boolean {
    const r = (regimen || '').toUpperCase();
    return r === 'RER' || r === 'REGIMEN_ESPECIAL' || r === 'ESPECIAL';
  }

  evaluate(context: TaxRuleContext): TaxRuleEvaluation {
    const errors: string[] = [];
    const isSubFive = context.total < 5.0;
    const isOverSevenHundred = context.total > 700.0;
    const isFactura = context.tipoDocumentoSeleccionado === '01';
    const clientRequestedReceipt = Boolean(
      context.cliente?.solicitaComprobante,
    );
    const clientRequestedIdentification = Boolean(
      context.cliente?.solicitaIdentificacion,
    );

    const documentRequired = !isSubFive || clientRequestedReceipt || isFactura;
    const customerDocumentRequired =
      isFactura || isOverSevenHundred || clientRequestedIdentification;
    const requiresValidRuc = isFactura;

    const allowedDocumentTypes: DocumentTypeOption[] = [
      {
        tipo: '03',
        descripcion: 'Boleta de Venta Electrónica',
        habilitado: true,
      },
      {
        tipo: '01',
        descripcion: 'Factura Electrónica',
        habilitado: true,
      },
      {
        tipo: 'NOTA_VENTA',
        descripcion: 'Nota de Venta Interna',
        habilitado: true,
      },
    ];

    if (isSubFive && !clientRequestedReceipt && !isFactura) {
      allowedDocumentTypes.push({
        tipo: 'SIN_COMPROBANTE',
        descripcion: 'Sin comprobante individual (Consolidado Diario)',
        habilitado: true,
      });
    }

    if (isFactura) {
      const tipoDoc = context.cliente?.tipoDoc;
      const numDoc = (context.cliente?.numeroDoc || '').trim();
      if (tipoDoc !== '6' || !/^\d{11}$/.test(numDoc)) {
        errors.push(
          'Para emitir Factura es obligatorio indicar un RUC válido de 11 dígitos.',
        );
      }
    }

    if (
      documentRequired &&
      context.tipoDocumentoSeleccionado === 'SIN_COMPROBANTE'
    ) {
      errors.push(
        'Las ventas a partir de S/ 5.00 requieren la emisión obligatoria de comprobante.',
      );
    }

    if (customerDocumentRequired && !isFactura) {
      const docNum = (context.cliente?.numeroDoc || '').trim();
      if (!docNum && isOverSevenHundred) {
        errors.push(
          'Para ventas superiores a S/ 700.00, SUNAT exige la identificación obligatoria del cliente (DNI / RUC / CE).',
        );
      }
    }

    return {
      allowedDocumentTypes,
      documentRequired,
      customerDocumentRequired,
      requiresValidRuc,
      canConsolidateDaily: isSubFive && !clientRequestedReceipt && !isFactura,
      errors,
    };
  }
}
