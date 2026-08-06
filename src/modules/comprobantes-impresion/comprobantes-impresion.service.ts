// src/modules/comprobantes-impresion/comprobantes-impresion.service.ts
import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { numeroALetras } from '../facturacion/utils/numero-a-letras.util';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { A4Template } from './templates/a4.template';
import { Ticket80Template } from './templates/ticket80.template';
import { Ticket58Template } from './templates/ticket58.template';
import {
  ComprobantePrintData,
  ComprobantePagoData,
} from './interfaces/comprobante-print-data.interface';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake/js/Printer').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const URLResolver = require('pdfmake/js/URLResolver').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const virtualfs = require('pdfmake/js/virtual-fs').default;

function fontsPdfmake() {
  const base = path.join(
    process.cwd(),
    'node_modules',
    'pdfmake',
    'fonts',
    'Roboto',
  );
  return {
    Roboto: {
      normal: path.join(base, 'Roboto-Regular.ttf'),
      bold: path.join(base, 'Roboto-Medium.ttf'),
      italics: path.join(base, 'Roboto-Italic.ttf'),
      bolditalics: path.join(base, 'Roboto-MediumItalic.ttf'),
    },
  };
}

@Injectable()
export class ComprobantesImpresionService implements OnModuleInit {
  private tempDir: string;
  private readonly logger = new Logger(ComprobantesImpresionService.name);

  constructor(private readonly prisma: PrismaService) {
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  onModuleInit() {
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  async depurarImpresion(
    ventaId: string,
    boticaId: string,
  ): Promise<Record<string, unknown>> {
    const resultado: Record<string, unknown> = {};

    this.logger.log(`[DIAGNÓSTICO] ventaId=${ventaId}, boticaId=${boticaId}`);
    resultado.ventaId = ventaId;
    resultado.boticaIdSolicitado = boticaId;

    const venta = await this.prisma.ventas.findFirst({
      where: { id: ventaId, deleted_at: null },
      include: {
        clientes: true,
        cajas: { include: { sucursales: true } },
        pagos: { include: { metodos_pago: true } },
        detalles_ventas: {
          where: { deleted_at: null },
          include: {
            productos_presentaciones: {
              include: {
                productos_comerciales: true,
                unidades_presentacion: true,
              },
            },
          },
        },
        comprobantes_electronicos: true,
      },
    });

    resultado.ventaEncontrada = venta ? 'SÍ' : 'NO';
    if (venta) {
      resultado.ventaBoticaId = venta.botica_id;
      resultado.ventaId = venta.id;
      resultado.ventaEstado = venta.estado;
      resultado.ventaTotal = venta.total;
      resultado.ventaFecha = venta.fecha;
      resultado.ventaClienteId = venta.cliente_id;
      resultado.ventaCajaId = venta.caja_id;
      resultado.clienteNombre = venta.clientes?.nombre ?? 'SIN CLIENTE';
      resultado.clienteTipoDoc = venta.clientes?.tipo_documento ?? 'N/A';
      resultado.clienteNumDoc = venta.clientes?.numero_documento ?? 'N/A';
      resultado.cajaNombre = venta.cajas?.nombre ?? 'SIN CAJA';
      resultado.sucursalNombre =
        venta.cajas?.sucursales?.nombre ?? 'SIN SUCURSAL';
      resultado.comprobantesExistentes =
        venta.comprobantes_electronicos?.length ?? 0;
      resultado.detallesCount = venta.detalles_ventas.length;
    } else {
      resultado.motivo = 'Venta no encontrada en la base de datos';
    }

    const botica = venta
      ? await this.prisma.boticas.findFirst({ where: { id: venta.botica_id } })
      : null;

    resultado.boticaEncontrada = botica ? 'SÍ' : 'NO';
    if (botica) {
      resultado.boticaId = botica.id;
      resultado.boticaRuc = botica.ruc;
      resultado.boticaRazonSocial = botica.razon_social;
      resultado.boticaNombre = botica.nombre;
      resultado.boticaDireccion = botica.direccion;
    }

    const boticaSolicitada = boticaId
      ? await this.prisma.boticas.findFirst({ where: { id: boticaId } })
      : null;

    resultado.boticaSolicitadaEncontrada = boticaSolicitada ? 'SÍ' : 'NO';
    if (boticaSolicitada) {
      resultado.boticaSolicitadaRuc = boticaSolicitada.ruc;
      resultado.boticaSolicitadaRazonSocial = boticaSolicitada.razon_social;
      resultado.boticaSolicitadaNombre = boticaSolicitada.nombre;
    }

    if (venta && botica && boticaSolicitada) {
      resultado.coincideBotica = venta.botica_id === boticaId;
      resultado.coincideRuc = botica.ruc === boticaSolicitada.ruc;
      resultado.coincideRazonSocial =
        botica.razon_social === boticaSolicitada.razon_social;
    }

    this.logger.log(
      `[DIAGNÓSTICO] Resultado: ${JSON.stringify(resultado, null, 2)}`,
    );

    return resultado;
  }

  async generarImpresionPdf(
    ventaId: string,
    formato: 'A4' | 'TICKET80' | 'TICKET58',
    boticaId: string,
  ): Promise<string> {
    this.logger.log(
      `[IMPRSIÓN] ventaId=${ventaId}, boticaId=${boticaId}, formato=${formato}`,
    );

    // 1. Cargar datos de la venta y relaciones
    const venta = await this.prisma.ventas.findFirst({
      where: { id: ventaId, botica_id: boticaId, deleted_at: null },
      include: {
        clientes: true,
        detalles_ventas: {
          where: { deleted_at: null },
          include: {
            productos_presentaciones: {
              include: {
                productos_comerciales: true,
                unidades_presentacion: true,
              },
            },
          },
        },
        pagos: {
          where: { deleted_at: null },
          include: { metodos_pago: true },
        },
        cajas: {
          include: { sucursales: true },
        },
        comprobantes_electronicos: true,
      },
    });

    this.logger.log(
      `[IMPRSIÓN] Venta encontrada: ${venta ? 'SÍ (botica_id=' + venta.botica_id + ')' : 'NO'}`,
    );

    if (!venta) {
      throw new NotFoundException('Venta no encontrada');
    }

    // 2. Cargar datos del emisor
    const botica = await this.prisma.boticas.findFirst({
      where: { id: boticaId },
    });

    this.logger.log(
      `[IMPRSIÓN] Botica cargada: ${botica ? botica.ruc + ' - ' + botica.razon_social : 'NO ENCONTRADA'}`,
    );

    if (!botica) {
      throw new NotFoundException('Empresa emisora no encontrada');
    }

    const compEl = venta.comprobantes_electronicos?.[0];
    const tipoComprobante = compEl ? compEl.tipo_comprobante : 'NOTA_VENTA';

    // 3. Obtener token público para consulta
    let publicToken: string;
    const publico = await this.prisma.comprobantes_publicos.findFirst({
      where: { venta_id: venta.id, botica_id: boticaId },
    });
    if (publico) {
      publicToken = publico.token_publico;
    } else {
      publicToken = crypto.randomBytes(32).toString('base64url');
      const snapshot = {
        venta_id: venta.id,
        tipo_comprobante: tipoComprobante,
        total: Number(venta.total),
      };
      await this.prisma.comprobantes_publicos.create({
        data: {
          venta_id: venta.id,
          botica_id: boticaId,
          token_publico: publicToken,
          plantilla_version: 'a4-v1',
          snapshot,
          hash_documento: '',
        },
      });
    }

    // 4. Generar URL de verificación y código QR
    const publicAppUrl =
      process.env.VITE_PUBLIC_APP_URL || 'https://localhost:5173';
    const verifyUrl = `${publicAppUrl}/c/${publicToken}`;
    const qrCodeBase64 = await QRCode.toDataURL(verifyUrl, {
      margin: 0,
      width: 140,
    });

    // 5. Determinar serie y correlativo
    let serie = 'NV01';
    let correlativo = 1;

    if (compEl) {
      serie = compEl.serie;
      correlativo = compEl.correlativo;
    } else {
      const count = await this.prisma.ventas.count({
        where: {
          botica_id: boticaId,
          fecha: { lte: venta.fecha },
          comprobantes_electronicos: { none: {} },
          deleted_at: null,
        },
      });
      correlativo = count || 1;
    }

    // 6. Mapear pagos
    const pagosMapeados: ComprobantePagoData[] = (venta.pagos || []).map(
      (p) => ({
        monto: Number(p.monto),
        metodoPago: p.metodos_pago?.nombre || 'EFECTIVO',
        referencia: p.referencia || undefined,
      }),
    );

    let montoRecibido: number | undefined;
    let vuelto: number | undefined;
    const pagoEfectivo = venta.pagos.find(
      (p) => p.metodos_pago?.nombre === 'EFECTIVO',
    );
    if (pagoEfectivo) {
      montoRecibido = Number(pagoEfectivo.monto);
      vuelto = 0;
    }

    // 7. Compilar items
    const items = venta.detalles_ventas.map((d) => {
      const comercial = d.productos_presentaciones?.productos_comerciales;
      const unidad = d.productos_presentaciones?.unidades_presentacion;
      const desc = comercial?.nombre_comercial || 'PRODUCTO';
      const pres = unidad?.nombre || '';
      const unitValue = Number(d.precio_unitario_presentacion) / 1.18;
      const subtotalValue = unitValue * d.cantidad;
      const igvValue = Number(d.subtotal) - subtotalValue;

      return {
        descripcion: desc,
        presentacion: pres,
        cantidad: d.cantidad,
        unidadMedida: 'NIU',
        valorUnitario: unitValue,
        precioUnitario: Number(d.precio_unitario_presentacion),
        valorVenta: subtotalValue,
        descuento: 0,
        codigoAfectacionIgv: '10',
        porcentajeIgv: 18,
        montoIgv: igvValue,
        importeTotal: Number(d.subtotal),
      };
    });

    // 8. Construir ComprobantePrintData
    const printData: ComprobantePrintData = {
      emisor: {
        ruc: botica.ruc,
        razonSocial: botica.razon_social,
        nombreComercial: botica.nombre,
        direccion: botica.direccion || '',
        codigoPais: 'PE',
      },
      cliente: {
        tipoDocumento: venta.clientes?.tipo_documento || 'NINGUNO',
        numeroDocumento: venta.clientes?.numero_documento || '00000000',
        razonSocial: venta.clientes?.nombre || 'CLIENTE GENERAL',
        direccion: venta.clientes?.direccion || undefined,
      },
      documento: {
        tipoComprobante: compEl ? compEl.tipo_comprobante : 'NOTA_VENTA',
        serie,
        correlativo,
        fechaEmision: venta.fecha,
        moneda: compEl?.moneda || 'PEN',
        formaPago: compEl?.forma_pago || 'CONTADO',
      },
      items,
      totales: {
        totalGravado: Number(
          compEl?.total_gravado || Number(venta.subtotal) - Number(venta.igv),
        ),
        totalExonerado: Number(compEl?.total_exonerado || 0),
        totalInafecto: Number(compEl?.total_inafecto || 0),
        totalGratuito: Number(compEl?.total_gratuito || 0),
        totalDescuentos: Number(
          compEl?.total_descuentos || Number(venta.descuento || 0),
        ),
        totalIgv: Number(compEl?.total_igv || Number(venta.igv)),
        subtotal: Number(compEl?.subtotal || Number(venta.subtotal)),
        total: Number(compEl?.total || Number(venta.total)),
        montoEnLetras: numeroALetras(
          Number(compEl?.total || Number(venta.total)),
        ),
      },
      sucursalNombre: venta.cajas?.sucursales?.nombre || '',
      sucursalDireccion: venta.cajas?.sucursales?.direccion || undefined,
      pagos: pagosMapeados,
      montoRecibido,
      vuelto,
      hash: compEl?.hash || undefined,
      qrCode: qrCodeBase64,
      estado: compEl?.estado || undefined,
    };

    // 9. Seleccionar plantilla y renderizar
    let templateInstance;
    if (formato === 'TICKET80') {
      templateInstance = new Ticket80Template();
    } else if (formato === 'TICKET58') {
      templateInstance = new Ticket58Template();
    } else {
      templateInstance = new A4Template();
    }

    const docDef = templateInstance.render(printData);
    const pdfBuffer = await this.renderPdf(docDef);

    // 10. Guardar archivo temporal en disco
    const filename = `${crypto.randomUUID()}.pdf`;
    const filePath = path.join(this.tempDir, filename);
    await fs.promises.writeFile(filePath, pdfBuffer);

    // 11. Programar borrado automático del archivo físico a los 5 minutos
    setTimeout(
      () => {
        fs.unlink(filePath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(
              `Error al eliminar archivo PDF temporal ${filename}:`,
              err,
            );
          }
        });
      },
      5 * 60 * 1000,
    );

    return filename;
  }

  private async renderPdf(docDef: any): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const printer = new PdfPrinter(
          fontsPdfmake(),
          virtualfs,
          new URLResolver(),
        );
        const pdfDoc = await printer.createPdfKitDocument(docDef);
        const chunks: Buffer[] = [];
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', (err) => reject(err));
        pdfDoc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  async obtenerArchivoTemporal(filename: string): Promise<Buffer> {
    const filePath = path.join(this.tempDir, filename);
    try {
      return await fs.promises.readFile(filePath);
    } catch (err) {
      throw new NotFoundException(
        'El archivo de impresión temporal ya no está disponible o ha expirado',
      );
    }
  }

  async obtenerBotica(
    boticaId: string,
    requestingBoticaId: string,
  ): Promise<Record<string, string>> {
    if (boticaId !== requestingBoticaId) {
      throw new NotFoundException('Botica no encontrada');
    }

    const botica = await this.prisma.boticas.findFirst({
      where: { id: boticaId },
    });

    if (!botica) {
      throw new NotFoundException('Botica no encontrada');
    }

    return {
      id: botica.id,
      nombre: botica.nombre,
      razon_social: botica.razon_social,
      ruc: botica.ruc,
      direccion: botica.direccion ?? '',
      telefono: botica.telefono ?? '',
    };
  }
}
