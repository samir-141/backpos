// src/modules/comprobantes-impresion/templates/ticket58.template.ts
import { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { ComprobanteTemplate } from './template.interface';
import { ComprobantePrintData } from '../interfaces/comprobante-print-data.interface';

const TIPOS_COMPROBANTE: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO',
  '08': 'NOTA DE DÉBITO',
};

function fmt(n: number): string {
  return (n || 0).toFixed(2);
}

export class Ticket58Template implements ComprobanteTemplate {
  render(data: ComprobantePrintData): TDocumentDefinitions {
    return {
      pageSize: { width: 164.41, height: 'auto' }, // 58 mm
      pageMargins: [4, 4, 4, 4],
      content: [
        ...this.encabezado(data),
        this.tablaItems(data),
        this.resumen(data),
        ...this.pie(data),
      ],
      styles: this.estilos(),
      defaultStyle: { font: 'Roboto', fontSize: 6 },
    };
  }

  private encabezado(data: ComprobantePrintData): Content[] {
    const { emisor, documento, sucursalNombre, sucursalDireccion } = data;
    const tipoLabel =
      TIPOS_COMPROBANTE[documento.tipoComprobante] ||
      documento.tipoComprobante ||
      'NOTA DE VENTA';

    return [
      { text: emisor.razonSocial, style: 'razonSocial' },
      ...(emisor.nombreComercial
        ? [{ text: emisor.nombreComercial, style: 'centrado' } as Content]
        : []),
      { text: `RUC: ${emisor.ruc}`, style: 'centrado' },
      { text: emisor.direccion, style: 'centrado', fontSize: 5.5 },
      ...(sucursalNombre
        ? [
            {
              text: `Suc: ${sucursalNombre}\n${sucursalDireccion || ''}`,
              style: 'centrado',
              fontSize: 5,
              color: '#444444',
            } as Content,
          ]
        : []),
      {
        text: tipoLabel,
        style: 'tituloDocumento',
        margin: [0, 4, 0, 0],
      },
      {
        text: `${documento.serie}-${String(documento.correlativo).padStart(8, '0')}`,
        style: 'numeroDocumento',
      },
    ];
  }

  private tablaItems(data: ComprobantePrintData): Content {
    const body = [
      [
        { text: 'Cant.', style: 'th' },
        { text: 'Descr.', style: 'th' },
        { text: 'P.U.', style: 'th', alignment: 'right' as const },
        { text: 'Tot.', style: 'th', alignment: 'right' as const },
      ],
      ...data.items.map((i) => [
        String(i.cantidad),
        i.descripcion,
        { text: fmt(i.precioUnitario), alignment: 'right' as const },
        { text: fmt(i.importeTotal), alignment: 'right' as const },
      ]),
    ];
    return {
      table: { widths: [16, '*', 28, 30], body },
      layout: 'lightHorizontalLines',
      margin: [0, 6, 0, 6],
    };
  }

  private resumen(data: ComprobantePrintData): Content {
    const t = data.totales;
    const filas: Content[] = [];
    if (t.totalGravado > 0) {
      filas.push(this.filaTotal('Op. Grav.', t.totalGravado));
    }
    if (t.totalExonerado > 0) {
      filas.push(this.filaTotal('Op. Exon.', t.totalExonerado));
    }
    if (t.totalInafecto > 0) {
      filas.push(this.filaTotal('Op. Inaf.', t.totalInafecto));
    }
    filas.push(this.filaTotal('IGV (18%)', t.totalIgv));
    filas.push({
      columns: [
        { text: 'TOTAL A PAGAR', bold: true },
        { text: `S/ ${fmt(t.total)}`, alignment: 'right', bold: true },
      ],
      margin: [0, 2, 0, 0],
    });
    return { stack: filas, margin: [0, 2, 0, 6] };
  }

  private filaTotal(etiqueta: string, valor: number): Content {
    return {
      columns: [
        { text: etiqueta },
        { text: `S/ ${fmt(valor)}`, alignment: 'right' },
      ],
    };
  }

  private pie(data: ComprobantePrintData): Content[] {
    const {
      cliente,
      documento,
      totales,
      pagos,
      montoRecibido,
      vuelto,
      hash,
      qrCode,
      estado,
    } = data;
    const contenido: Content[] = [
      {
        text: `Cli: ${cliente.razonSocial}`,
        style: 'detalle',
        bold: true,
      },
      {
        text: `RUC/DNI: ${cliente.numeroDocumento}`,
        style: 'detalle',
      },
      {
        text: `Fec: ${documento.fechaEmision.toLocaleString('es-PE')}`,
        style: 'detalle',
      },
      {
        text: `SON: ${totales.montoEnLetras}`,
        style: 'detalle',
        fontSize: 5.5,
      },
    ];

    // Detalle de Pagos
    if (pagos && pagos.length > 0) {
      contenido.push({
        text: 'PAGO:',
        style: 'seccionTitulo',
        margin: [0, 3, 0, 1],
      });
      pagos.forEach((p) => {
        contenido.push({
          text: `${p.metodoPago}: S/ ${fmt(p.monto)}${p.referencia ? ` (${p.referencia})` : ''}`,
          style: 'detalle',
        });
      });
      if (montoRecibido !== undefined && montoRecibido > 0) {
        contenido.push({
          text: `Efect.: S/ ${fmt(montoRecibido)}  Vto: S/ ${fmt(vuelto || 0)}`,
          style: 'detalle',
        });
      }
    }

    if (
      estado &&
      estado !== 'ACEPTADO' &&
      estado !== 'ACEPTADO_CON_OBSERVACIONES'
    ) {
      contenido.push({
        text: `ESTADO: ${estado} (No SUNAT)`,
        style: 'estadoAdvertencia',
        margin: [0, 3, 0, 3],
      });
    }

    if (qrCode) {
      contenido.push({
        alignment: 'center',
        image: qrCode,
        width: 65,
        margin: [0, 6, 0, 3],
      });
      if (hash) {
        contenido.push({
          text: `Hash: ${hash}`,
          style: 'hash',
          alignment: 'center',
        });
      }
      contenido.push({
        text: 'Representación impresa. Consulte en www.sunat.gob.pe',
        style: 'leyenda',
        alignment: 'center',
      });
    }

    return contenido;
  }

  private estilos(base = 6): Record<string, object> {
    return {
      razonSocial: { fontSize: base + 2, bold: true, alignment: 'center' },
      centrado: { alignment: 'center' },
      tituloDocumento: {
        fontSize: base + 0.5,
        bold: true,
        alignment: 'center',
      },
      numeroDocumento: {
        fontSize: base + 1.5,
        bold: true,
        alignment: 'center',
      },
      th: { bold: true },
      detalle: { fontSize: base - 0.5, margin: [0, 0.5, 0, 0.5] },
      seccionTitulo: { fontSize: base - 0.5, bold: true },
      hash: { fontSize: base - 1.5 },
      leyenda: { fontSize: base - 1.5, italics: true },
      estadoAdvertencia: { color: 'red', bold: true, fontSize: base },
    };
  }
}
