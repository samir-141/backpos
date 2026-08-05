import { Injectable, BadRequestException } from '@nestjs/common';
import { AfectacionIgv } from '../sunat/catalogos.enum';
import { UnidadMedidaSunat } from '../domain/ambiente-sunat.enum';
import {
  ComprobanteItemData,
  TotalesComprobanteData,
} from '../domain/comprobante-data.interface';
import { numeroALetras } from '../utils/numero-a-letras.util';

export const IGV_TASA = 0.18;

export interface LineaVentaInput {
  codigoProducto?: string;
  descripcion: string;
  unidadMedida?: string;
  cantidad: number;
  precioUnitarioConIgv: number;
  descuento?: number;
  afectoIgv: boolean;
}

export interface ResultadoTributario {
  items: ComprobanteItemData[];
  totales: TotalesComprobanteData;
}

/**
 * Cálculo tributario de comprobantes SUNAT.
 * Toda la aritmética monetaria se realiza en céntimos enteros
 * (round half-up) para evitar errores de punto flotante.
 */
@Injectable()
export class TributosCalculatorService {
  calcular(lineas: LineaVentaInput[], moneda = 'PEN'): ResultadoTributario {
    if (!lineas.length) {
      throw new BadRequestException(
        'El comprobante debe tener al menos un ítem',
      );
    }

    const items: ComprobanteItemData[] = [];
    let gravadoCents = 0;
    let exoneradoCents = 0;
    const inafectoCents = 0;
    let igvCents = 0;
    let descuentosCents = 0;

    for (const [indice, linea] of lineas.entries()) {
      if (!linea.descripcion?.trim()) {
        throw new BadRequestException(
          `El ítem ${indice + 1} no tiene descripción`,
        );
      }
      if (!(linea.cantidad > 0)) {
        throw new BadRequestException(
          `El ítem ${indice + 1} tiene cantidad inválida`,
        );
      }
      if (!(linea.precioUnitarioConIgv >= 0)) {
        throw new BadRequestException(
          `El ítem ${indice + 1} tiene precio inválido`,
        );
      }

      const codigoAfectacion = linea.afectoIgv
        ? AfectacionIgv.GRAVADO_OP_ONEROSO
        : AfectacionIgv.EXONERADO_OP_ONEROSO;

      const brutoCents = Math.round(
        linea.precioUnitarioConIgv * linea.cantidad * 100,
      );
      const descuentoCents = Math.round((linea.descuento ?? 0) * 100);
      const netoConIgvCents = brutoCents - descuentoCents;
      if (netoConIgvCents < 0) {
        throw new BadRequestException(
          `El descuento del ítem ${indice + 1} supera su importe`,
        );
      }

      let valorVentaCents: number;
      let montoIgvCents: number;
      if (linea.afectoIgv) {
        valorVentaCents = Math.round(netoConIgvCents / (1 + IGV_TASA));
        montoIgvCents = netoConIgvCents - valorVentaCents;
      } else {
        valorVentaCents = netoConIgvCents;
        montoIgvCents = 0;
      }

      const valorUnitario = valorVentaCents / linea.cantidad / 100;
      const precioUnitario =
        (valorVentaCents + montoIgvCents) / linea.cantidad / 100;

      if (linea.afectoIgv) {
        gravadoCents += valorVentaCents;
        igvCents += montoIgvCents;
      } else {
        exoneradoCents += valorVentaCents;
      }
      descuentosCents += descuentoCents;

      items.push({
        codigoProducto: linea.codigoProducto,
        descripcion: linea.descripcion.trim(),
        unidadMedida: linea.unidadMedida ?? UnidadMedidaSunat.UNIDAD,
        cantidad: linea.cantidad,
        valorUnitario,
        precioUnitario,
        valorVenta: valorVentaCents / 100,
        descuento: descuentoCents / 100,
        codigoAfectacionIgv: codigoAfectacion,
        porcentajeIgv: linea.afectoIgv ? IGV_TASA * 100 : 0,
        montoIgv: montoIgvCents / 100,
        importeTotal: (valorVentaCents + montoIgvCents) / 100,
      });
    }

    const subtotalCents = gravadoCents + exoneradoCents + inafectoCents;
    const totalCents = subtotalCents + igvCents;

    return {
      items,
      totales: {
        totalGravado: gravadoCents / 100,
        totalExonerado: exoneradoCents / 100,
        totalInafecto: inafectoCents / 100,
        totalGratuito: 0,
        totalDescuentos: descuentosCents / 100,
        totalIgv: igvCents / 100,
        subtotal: subtotalCents / 100,
        total: totalCents / 100,
        montoEnLetras: numeroALetras(
          totalCents / 100,
          moneda === 'PEN' ? 'SOLES' : moneda,
        ),
      },
    };
  }
}
