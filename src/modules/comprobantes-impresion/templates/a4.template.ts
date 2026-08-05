// src/modules/comprobantes-impresion/templates/a4.template.ts
import { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { ComprobanteTemplate } from './template.interface';
import { ComprobantePrintData } from '../interfaces/comprobante-print-data.interface';

const TIPOS_COMPROBANTE: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
  '08': 'NOTA DE DÉBITO ELECTRÓNICA',
};

function fmt(n: number): string {
  return (n || 0).toFixed(2);
}

export class A4Template implements ComprobanteTemplate {
  render(data: ComprobantePrintData): TDocumentDefinitions {
    return {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      content: [
        ...this.encabezado(data),
        this.tablaItems(data),
        this.resumen(data),
        ...this.pie(data),
      ],
      styles: this.estilos(),
      defaultStyle: { font: 'Roboto', fontSize: 10 },
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
      { text: emisor.direccion, style: 'centrado', fontSize: 9 },
      ...(sucursalNombre
        ? [
            {
              text: `Sucursal: ${sucursalNombre} - ${sucursalDireccion || ''}`,
              style: 'centrado',
              fontSize: 8,
              color: '#555555',
            } as Content,
          ]
        : []),
      {
        text: tipoLabel,
        style: 'tituloDocumento',
        margin: [0, 10, 0, 0],
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
        { text: 'Descripción', style: 'th' },
        { text: 'P. Unit.', style: 'th', alignment: 'right' as const },
        { text: 'Importe', style: 'th', alignment: 'right' as const },
      ],
      ...data.items.map((i) => [
        String(i.cantidad),
        i.descripcion,
        { text: fmt(i.precioUnitario), alignment: 'right' as const },
        { text: fmt(i.importeTotal), alignment: 'right' as const },
      ]),
    ];
    return {
      table: { widths: [40, '*', 70, 70], body },
      layout: 'lightHorizontalLines',
      margin: [0, 12, 0, 12],
    };
  }

  private resumen(data: ComprobantePrintData): Content {
    const t = data.totales;
    const filas: Content[] = [];
    if (t.totalGravado > 0) {
      filas.push(this.filaTotal('Op. Gravada', t.totalGravado));
    }
    if (t.totalExonerado > 0) {
      filas.push(this.filaTotal('Op. Exonerada', t.totalExonerado));
    }
    if (t.totalInafecto > 0) {
      filas.push(this.filaTotal('Op. Inafecta', t.totalInafecto));
    }
    filas.push(this.filaTotal('IGV (18%)', t.totalIgv));
    filas.push({
      columns: [
        { text: 'TOTAL A PAGAR', bold: true },
        { text: `S/ ${fmt(t.total)}`, alignment: 'right', bold: true },
      ],
      margin: [0, 4, 0, 0],
    });
    return { stack: filas, margin: [0, 4, 0, 12] };
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
        text: `Cliente: ${cliente.razonSocial}`,
        style: 'detalle',
        bold: true,
      },
      {
        text: `Documento: ${cliente.numeroDocumento}    Fecha: ${documento.fechaEmision.toLocaleString('es-PE')}    Moneda: ${documento.moneda}`,
        style: 'detalle',
      },
      { text: `SON: ${totales.montoEnLetras}`, style: 'detalle' },
    ];

    // Detalle de Pagos
    if (pagos && pagos.length > 0) {
      contenido.push({
        text: 'MÉTODOS DE PAGO:',
        style: 'seccionTitulo',
        margin: [0, 8, 0, 2],
      });
      pagos.forEach((p) => {
        contenido.push({
          text: `- ${p.metodoPago}: S/ ${fmt(p.monto)}${p.referencia ? ` (Ref: ${p.referencia})` : ''}`,
          style: 'detalle',
        });
      });
      if (montoRecibido !== undefined && montoRecibido > 0) {
        contenido.push({
          text: `Efectivo recibido: S/ ${fmt(montoRecibido)}    Vuelto: S/ ${fmt(vuelto || 0)}`,
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
        text: `ESTADO: ${estado} (No válido como representación oficial de SUNAT)`,
        style: 'estadoAdvertencia',
        margin: [0, 6, 0, 6],
      });
    }

    if (qrCode) {
      contenido.push({
        columns: [
          { image: qrCode, width: 90 },
          {
            stack: [
              ...(hash
                ? [{ text: `Hash: ${hash}`, style: 'hash' } as Content]
                : []),
              {
                text: 'Representación impresa del comprobante electrónico. Consulte su validez en www.sunat.gob.pe o escaneando el código QR.',
                style: 'leyenda',
              },
            ],
            margin: [10, 8, 0, 0] as [number, number, number, number],
          },
        ],
        margin: [0, 12, 0, 0],
      });
    }

    return contenido;
  }

  private estilos(base = 10): Record<string, object> {
    return {
      razonSocial: { fontSize: base + 3, bold: true, alignment: 'center' },
      centrado: { alignment: 'center' },
      tituloDocumento: { fontSize: base + 1, bold: true, alignment: 'center' },
      numeroDocumento: {
        fontSize: base + 4,
        bold: true,
        alignment: 'center',
      },
      th: { bold: true },
      detalle: { fontSize: base - 1, margin: [0, 1, 0, 1] },
      seccionTitulo: { fontSize: base - 1, bold: true },
      hash: { fontSize: base - 2 },
      leyenda: { fontSize: base - 2, italics: true },
      estadoAdvertencia: { color: 'red', bold: true, fontSize: base },
    };
  }
}
