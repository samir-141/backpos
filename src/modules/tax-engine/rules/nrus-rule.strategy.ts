import { Injectable } from '@nestjs/common';
import {
  DocumentTypeOption,
  TaxRuleContext,
  TaxRuleEvaluation,
  TaxRuleStrategy,
} from '../interfaces/tax-rule-strategy.interface';

@Injectable()
export class NrusRuleStrategy implements TaxRuleStrategy {
  supports(regimen: string): boolean {
    const r = (regimen || '').toUpperCase();
    return r === 'NRUS' || r === 'NUEVO_RUS' || r === 'RUS';
  }

  evaluate(context: TaxRuleContext): TaxRuleEvaluation {
    const errors: string[] = [];
    const isSubFive = context.total < 5.0;
    const isOverSevenHundred = context.total > 700.0;
    const clientRequestedReceipt = Boolean(
      context.cliente?.solicitaComprobante,
    );
    const clientRequestedIdentification = Boolean(
      context.cliente?.solicitaIdentificacion,
    );

    // En NRUS: Obligatorio si total >= 5.00 o si el cliente lo solicita
    const documentRequired = !isSubFive || clientRequestedReceipt;

    // En NRUS: Identificación obligatoria si total > 700.00 o si el cliente lo solicita
    const customerDocumentRequired =
      isOverSevenHundred || clientRequestedIdentification;

    // Document types definition for NRUS
    const allowedDocumentTypes: DocumentTypeOption[] = [
      {
        tipo: '03',
        descripcion: 'Boleta de Venta Electrónica',
        habilitado: true,
      },
      {
        tipo: '12',
        descripcion: 'Ticket POS (SEE-CF)',
        habilitado: true,
      },
      {
        tipo: '01',
        descripcion: 'Factura Electrónica',
        habilitado: false,
        motivoBloqueo:
          'Los contribuyentes en el Nuevo RUS (NRUS) no pueden emitir facturas con crédito fiscal.',
      },
      {
        tipo: 'NOTA_VENTA',
        descripcion: 'Nota de Venta Interna',
        habilitado: true,
      },
    ];

    if (isSubFive && !clientRequestedReceipt) {
      allowedDocumentTypes.push({
        tipo: 'SIN_COMPROBANTE',
        descripcion: 'Sin comprobante individual (Consolidado Diario)',
        habilitado: true,
      });
    }

    // Validations on selected document
    if (context.tipoDocumentoSeleccionado === '01') {
      errors.push('El régimen Nuevo RUS no permite la emisión de Facturas.');
    }

    if (
      documentRequired &&
      context.tipoDocumentoSeleccionado === 'SIN_COMPROBANTE'
    ) {
      errors.push(
        'Las ventas a partir de S/ 5.00 requieren la emisión obligatoria de comprobante.',
      );
    }

    if (customerDocumentRequired) {
      const docNum = (context.cliente?.numeroDoc || '').trim();
      if (!docNum) {
        if (isOverSevenHundred) {
          errors.push(
            'Para ventas superiores a S/ 700.00, SUNAT exige la identificación obligatoria del cliente (DNI / RUC / Carné de Extranjería).',
          );
        } else {
          errors.push(
            'El cliente ha solicitado consignar su documento de identificación.',
          );
        }
      }
    }

    return {
      allowedDocumentTypes,
      documentRequired,
      customerDocumentRequired,
      requiresValidRuc: false,
      canConsolidateDaily: isSubFive && !clientRequestedReceipt,
      errors,
    };
  }
}
