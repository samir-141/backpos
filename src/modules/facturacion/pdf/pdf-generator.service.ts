import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import * as QRCode from 'qrcode';
import * as path from 'path';
import { ComprobanteSunatData } from '../domain/comprobante-data.interface';

// pdfmake 0.3 (Node) no trae tipos propios y @types/pdfmake solo cubre la API
// de navegador; se tipa el entrypoint de Node (js/index.js → Printer).
interface PdfKitStream extends NodeJS.EventEmitter {
  on(event: 'data', cb: (chunk: Buffer) => void): this;
  on(event: 'end', cb: () => void): this;
  on(event: 'error', cb: (err: Error) => void): this;
  end(): void;
}
type PdfPrinterCtor = new (
  fonts: {
    [name: string]: {
      normal: string;
      bold: string;
      italics: string;
      bolditalics: string;
    };
  },
  virtualfs?: any,
  urlResolver?: any,
) => {
  createPdfKitDocument(doc: TDocumentDefinitions): Promise<PdfKitStream>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake/js/Printer').default as PdfPrinterCtor;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const URLResolver = require('pdfmake/js/URLResolver').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const virtualfs = require('pdfmake/js/virtual-fs').default;

export type FormatoPdf = 'A4' | 'TICKET80';

export interface ExtrasPdf {
  hash?: string;
  estado?: string;
}

const TIPOS_COMPROBANTE: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
  '08': 'NOTA DE DÉBITO ELECTRÓNICA',
};

function fontsPdfmake() {
  const base = path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto');
  return {
    Roboto: {
      normal: path.join(base, 'Roboto-Regular.ttf'),
      bold: path.join(base, 'Roboto-Medium.ttf'),
      italics: path.join(base, 'Roboto-Italic.ttf'),
      bolditalics: path.join(base, 'Roboto-MediumItalic.ttf'),
    },
  };
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/** Representación impresa (PDF A4 o ticket 80 mm) del comprobante. */
@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  async generarPdf(
    data: ComprobanteSunatData,
    extras: ExtrasPdf = {},
    formato: FormatoPdf = 'A4',
  ): Promise<Buffer> {
    try {
      const qr = await this.generarQr(data, extras.hash);
      const doc =
        formato === 'TICKET80'
          ? this.documentoTicket(data, extras, qr)
          : this.documentoA4(data, extras, qr);
      return await this.render(doc);
    } catch (error) {
      this.logger.error(`Error generando PDF: ${(error as Error).message}`);
      throw new InternalServerErrorException(
        'No se pudo generar la representación impresa',
      );
    }
  }

  private async generarQr(
    data: ComprobanteSunatData,
    hash?: string,
  ): Promise<string> {
    const { emisor, documento, cliente, totales } = data;
    const fecha = documento.fechaEmision;
    const fechaTxt = [
      String(fecha.getDate()).padStart(2, '0'),
      String(fecha.getMonth() + 1).padStart(2, '0'),
      fecha.getFullYear(),
    ].join('/');
    const contenido = [
      emisor.ruc,
      documento.tipoComprobante,
      documento.serie,
      documento.correlativo,
      fmt(totales.totalIgv),
      fmt(totales.total),
      fechaTxt,
      cliente.tipoDocumento,
      cliente.numeroDocumento,
      hash ?? '',
    ].join('|');
    return QRCode.toDataURL(contenido, { margin: 0, width: 140 });
  }

  private encabezado(data: ComprobanteSunatData): Content[] {
    const { emisor, documento } = data;
    return [
      { text: emisor.razonSocial, style: 'razonSocial' },
      ...(emisor.nombreComercial
        ? [{ text: emisor.nombreComercial, style: 'centrado' } as Content]
        : []),
      { text: `RUC: ${emisor.ruc}`, style: 'centrado' },
      { text: emisor.direccion, style: 'centrado' },
      {
        text: TIPOS_COMPROBANTE[documento.tipoComprobante] ?? 'COMPROBANTE',
        style: 'tituloDocumento',
        margin: [0, 8, 0, 0] as [number, number, number, number],
      },
      {
        text: `${documento.serie}-${documento.correlativo}`,
        style: 'numeroDocumento',
      },
    ];
  }

  private tablaItems(
    data: ComprobanteSunatData,
    ancho: (string | number)[],
  ): Content {
    const body = [
      [
        { text: 'Cant.', style: 'th' },
        { text: 'Descripción', style: 'th' },
        { text: 'P. Unit.', style: 'th' },
        { text: 'Importe', style: 'th' },
      ],
      ...data.items.map((i) => [
        String(i.cantidad),
        i.descripcion,
        fmt(i.precioUnitario),
        { text: fmt(i.importeTotal), alignment: 'right' as const },
      ]),
    ];
    return {
      table: { widths: ancho, body },
      layout: 'lightHorizontalLines',
      margin: [0, 8, 0, 8],
    };
  }

  private resumen(data: ComprobanteSunatData): Content {
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
    });
    return { stack: filas, margin: [0, 4, 0, 8] };
  }

  private filaTotal(etiqueta: string, valor: number): Content {
    return {
      columns: [
        { text: etiqueta },
        { text: `S/ ${fmt(valor)}`, alignment: 'right' },
      ],
    };
  }

  private pie(
    data: ComprobanteSunatData,
    extras: ExtrasPdf,
    qr: string,
  ): Content[] {
    const { cliente, documento, totales } = data;
    const contenido: Content[] = [
      {
        text: `Cliente: ${cliente.razonSocial}`,
        style: 'detalle',
      },
      {
        text: `Documento: ${cliente.numeroDocumento}    Fecha: ${documento.fechaEmision.toLocaleDateString('es-PE')}    Forma de pago: ${documento.formaPago}`,
        style: 'detalle',
      },
      { text: `SON: ${totales.montoEnLetras}`, style: 'detalle' },
    ];
    if (extras.estado && !extras.estado.startsWith('ACEPTADO')) {
      contenido.push({
        text: `ESTADO: ${extras.estado} (no válido como comprobante aceptado)`,
        style: 'estadoAdvertencia',
      });
    }
    contenido.push({
      columns: [
        { image: qr, width: 90 },
        {
          stack: [
            ...(extras.hash
              ? [{ text: `Hash: ${extras.hash}`, style: 'hash' } as Content]
              : []),
            {
              text: 'Representación impresa del comprobante electrónico. Consulte su validez en www.sunat.gob.pe',
              style: 'leyenda',
            },
          ],
          margin: [10, 8, 0, 0] as [number, number, number, number],
        },
      ],
      margin: [0, 10, 0, 0],
    });
    return contenido;
  }

  private documentoA4(
    data: ComprobanteSunatData,
    extras: ExtrasPdf,
    qr: string,
  ): TDocumentDefinitions {
    return {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      content: [
        ...this.encabezado(data),
        this.tablaItems(data, [40, '*', 70, 70]),
        this.resumen(data),
        ...this.pie(data, extras, qr),
      ],
      styles: this.estilos(),
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };
  }

  private documentoTicket(
    data: ComprobanteSunatData,
    extras: ExtrasPdf,
    qr: string,
  ): TDocumentDefinitions {
    return {
      pageSize: { width: 226.77, height: 'auto' }, // 80 mm
      pageMargins: [8, 8, 8, 8],
      content: [
        ...this.encabezado(data),
        this.tablaItems(data, [25, '*', 40, 45]),
        this.resumen(data),
        ...this.pie(data, extras, qr),
      ],
      styles: this.estilos(7),
      defaultStyle: { font: 'Roboto', fontSize: 7 },
    };
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
      hash: { fontSize: base - 2 },
      leyenda: { fontSize: base - 2, italics: true },
      estadoAdvertencia: { color: 'red', bold: true, fontSize: base },
    };
  }

  private async render(doc: TDocumentDefinitions): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const printer = new PdfPrinter(fontsPdfmake(), virtualfs, new URLResolver());
        const pdfDoc = await printer.createPdfKitDocument(doc);
        const chunks: Buffer[] = [];
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);
        pdfDoc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
