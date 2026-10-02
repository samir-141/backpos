import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  EmissionContext,
  EmissionResult,
  IEmissionProvider,
} from '../router/emission-provider.interface';
import { SunatSolBotService } from './sunat-sol-bot.service';
import { ComprobanteStorageService } from '../storage/comprobante-storage.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EstadoComprobante } from '../domain/estado-comprobante.enum';
import { EventsGateway } from '../../../socket/events.gateway';

@Injectable()
export class SunatSolEmissionProvider implements IEmissionProvider {
  private readonly logger = new Logger(SunatSolEmissionProvider.name);
  readonly nombre = 'SUNAT_SOL_BOT';

  constructor(
    private readonly botService: SunatSolBotService,
    private readonly storage: ComprobanteStorageService,
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  async emitir(ctx: EmissionContext): Promise<EmissionResult> {
    const { boticaId, comprobante } = ctx;
    this.logger.log(
      `Ejecutando proveedor SUNAT_SOL_BOT para comprobante ${comprobante.serie}-${comprobante.correlativo ?? comprobante.numero}, Botica: ${boticaId}`,
    );

    // 1. Obtener configuración tributaria y credenciales SOL de la botica
    let ruc = '';
    let solUsuario: string | undefined;
    let solClave: string | undefined;
    let esDni = false;
    let ambiente = 'BETA';

    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: {
        botica_id: boticaId,
        ...(ctx.perfilTributario?.id ? { id: ctx.perfilTributario.id } : {}),
        deleted_at: null,
      },
      include: { configuracion_emision: true },
    });

    if (perfil?.configuracion_emision?.sol_clave_encriptada) {
      ruc = perfil.ruc;
      solClave = this.encryption.decrypt(
        perfil.configuracion_emision.sol_clave_encriptada,
      );
      if (perfil.configuracion_emision.sol_usuario_encriptado) {
        solUsuario = this.encryption.decrypt(
          perfil.configuracion_emision.sol_usuario_encriptado,
        );
      }
      ambiente = perfil.configuracion_emision.ambiente || 'BETA';
      esDni =
        !solUsuario || /^\d{8}$/.test(solUsuario) || perfil.ruc?.length === 8;
    } else {
      const config = await this.prisma.configuraciones_tributarias.findUnique({
        where: { botica_id: boticaId },
      });

      if (!config || !config.sol_clave_encriptada) {
        return {
          exito: false,
          estado: EstadoComprobante.ERROR_ENVIO,
          codigo_respuesta: 'CREDENTIALS_MISSING',
          mensaje_respuesta:
            'No se han configurado las credenciales SOL para la emisión automatizada',
        };
      }

      ruc = config.ruc;
      solClave = this.encryption.decrypt(config.sol_clave_encriptada);
      if (config.sol_usuario_encriptado) {
        solUsuario = this.encryption.decrypt(config.sol_usuario_encriptado);
      }
      ambiente = config.ambiente || 'BETA';
      esDni =
        !solUsuario || /^\d{8}$/.test(solUsuario) || config.ruc?.length === 8;
    }

    // 2. Mapear receptor (DNI, RUC, Sin Documento / RUS, etc.)
    const rawTipoDoc = String(
      comprobante.cliente_tipo_documento || comprobante.cliente_tipo_doc || '',
    ).trim();

    const rawNumDoc = String(
      comprobante.cliente_numero_documento ||
        comprobante.cliente_numero_doc ||
        '',
    ).trim();

    const esSinDoc =
      !rawNumDoc ||
      rawNumDoc === '0' ||
      rawNumDoc === '-' ||
      rawNumDoc === '00000000' ||
      rawTipoDoc === '0' ||
      rawTipoDoc === 'SIN_DOCUMENTO' ||
      rawTipoDoc === 'SIN DOCUMENTO' ||
      rawTipoDoc === 'NINGUNO' ||
      rawTipoDoc === '-' ||
      rawTipoDoc === 'VARIOS';

    let tipoDoc = '0';
    let numeroDoc: string | undefined = undefined;

    if (!esSinDoc) {
      if (rawTipoDoc === 'RUC' || rawTipoDoc === '6') tipoDoc = '6';
      else if (rawTipoDoc === 'DNI' || rawTipoDoc === '1') tipoDoc = '1';
      else if (
        rawTipoDoc === 'CE' ||
        rawTipoDoc === 'CARNET_EXTRANJERIA' ||
        rawTipoDoc === '4'
      )
        tipoDoc = '4';
      else if (rawTipoDoc === 'PASAPORTE' || rawTipoDoc === '7') tipoDoc = '7';
      else tipoDoc = rawTipoDoc || '1';
      numeroDoc = rawNumDoc;
    }

    const receptor = {
      tipoDoc,
      numeroDoc,
      razonSocialODatos:
        comprobante.cliente_razon_social ||
        comprobante.cliente_nombre ||
        (esSinDoc ? 'CLIENTES VARIOS' : undefined),
      direccion: comprobante.cliente_direccion || undefined,
    };

    // 3. Mapear ítems del comprobante (priorizando código de barras de la venta/presentación)
    const mapCodigoBarras = new Map<string, string>();
    if (comprobante.venta_id) {
      try {
        const venta = await this.prisma.ventas.findUnique({
          where: { id: comprobante.venta_id },
          include: {
            detalles_ventas: {
              include: {
                productos_presentaciones: {
                  include: { productos_comerciales: true },
                },
              },
            },
          },
        });
        if (venta?.detalles_ventas) {
          for (const dv of venta.detalles_ventas) {
            const cb =
              dv.productos_presentaciones?.codigo_barras?.trim() ||
              (
                dv.productos_presentaciones?.productos_comerciales as any
              )?.codigo_barras?.trim();
            const desc =
              dv.productos_presentaciones?.productos_comerciales?.nombre_comercial?.trim();
            const codProd =
              dv.productos_presentaciones?.productos_comerciales?.codigo_interno?.trim() ||
              dv.productos_presentaciones?.productos_comerciales?.sku?.trim();
            if (cb) {
              if (desc) mapCodigoBarras.set(desc.toLowerCase(), cb);
              if (codProd) mapCodigoBarras.set(codProd.toLowerCase(), cb);
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(
          `No se pudo consultar código de barras de la venta: ${e.message}`,
        );
      }
    }

    const items = (comprobante.detalles || []).map((det: any) => {
      const desc = det.descripcion || 'Producto farmacéutico';
      const codOriginal = det.codigo_producto || det.producto_id || '1';
      const codigoBarras =
        mapCodigoBarras.get(desc.trim().toLowerCase()) ||
        mapCodigoBarras.get(codOriginal.trim().toLowerCase()) ||
        codOriginal;

      const rawPrecio =
        det.precio_unitario ??
        det.precio_unitario_presentacion ??
        det.valor_unitario ??
        det.precio ??
        det.monto ??
        (det.subtotal && det.cantidad
          ? Number(det.subtotal) / Number(det.cantidad)
          : undefined) ??
        (det.total && det.cantidad
          ? Number(det.total) / Number(det.cantidad)
          : undefined) ??
        0;
      const precioUnitario = Number(rawPrecio) > 0 ? Number(rawPrecio) : 0;

      return {
        tipo: det.tipo_item === 'SERVICIO' ? 'SERVICIO' : 'BIEN',
        codigo: codigoBarras,
        descripcion: desc,
        cantidad: Number(det.cantidad || 1),
        precioUnitario,
      };
    });

    // 4. Invocar el bot de Playwright
    const dniTitular = esDni
      ? solUsuario && /^\d{8}$/.test(solUsuario)
        ? solUsuario
        : ruc.startsWith('10')
          ? ruc.slice(2, 10)
          : ruc
      : undefined;

    const tipoComp =
      comprobante.tipo_comprobante === '01' ||
      comprobante.tipo_comprobante === 'FACTURA'
        ? 'FACTURA'
        : 'BOLETA';

    const resultado = await this.botService.emitirBoletaSol({
      boticaId,
      credenciales: {
        ruc,
        dni: dniTitular,
        usuario: solUsuario,
        clave: solClave,
        modoAcceso: esDni ? 'DNI' : 'RUC',
      },
      tipoComprobante: tipoComp,
      receptor,
      items,
      observaciones: comprobante.observaciones || undefined,
      headless: ambiente !== 'DEVELOPMENT_DEBUG',
      onProgreso: (progreso) => {
        this.logger.debug(
          `[Progreso SOL] Paso ${progreso.paso}/${progreso.totalPasos} (${progreso.porcentaje}%): ${progreso.titulo}`,
        );
        if (this.eventsGateway) {
          const payload = {
            botica_id: boticaId,
            sucursal_id: comprobante.sucursal_id,
            comprobante_id: comprobante.id,
            venta_id: comprobante.venta_id,
            ...progreso,
          };
          if (comprobante.sucursal_id) {
            this.eventsGateway.emitirASucursal(
              comprobante.sucursal_id,
              'facturacion.progreso',
              payload,
            );
          }
          this.eventsGateway.emitirGlobal('facturacion.progreso', payload);
        }
      },
    });

    if (!resultado.exito) {
      return {
        exito: false,
        estado: EstadoComprobante.ERROR_ENVIO,
        codigo_respuesta: resultado.codigoError || 'SOL_BOT_ERROR',
        mensaje_respuesta:
          resultado.mensajeRespuesta || 'Error en automatización SUNAT SOL',
        observaciones: {
          screenshotBase64: resultado.screenshotBase64,
          duracionMs: resultado.duracionMs,
        },
      };
    }

    // 5. Si generó PDF, almacenarlo
    let pdfPath: string | undefined;
    if (resultado.pdfBuffer) {
      try {
        const nombreCarpeta = `03-${resultado.numeroComprobante || comprobante.serie + '-' + comprobante.numero}`;
        const dir = this.storage.directorioComprobante(
          ruc,
          comprobante.fecha_emision
            ? new Date(comprobante.fecha_emision)
            : new Date(),
          nombreCarpeta,
        );
        pdfPath = await this.storage.guardarPdf(dir, resultado.pdfBuffer);
      } catch (err: any) {
        this.logger.warn(
          `No se pudo almacenar el PDF oficial de SUNAT SOL: ${err.message}`,
        );
      }
    }

    return {
      exito: true,
      estado: EstadoComprobante.ACEPTADO,
      codigo_respuesta: '0',
      mensaje_respuesta:
        resultado.mensajeRespuesta || 'Aceptado por SUNAT SEE-SOL',
      ticket_sunat: resultado.numeroComprobante,
      observaciones: {
        numeroComprobanteSol: resultado.numeroComprobante,
        pdfPath,
        duracionMs: resultado.duracionMs,
      },
    };
  }
}
