import { Injectable } from '@nestjs/common';
import {
  ComprobanteSunatData,
  DocumentoComprobanteData,
} from '../domain/comprobante-data.interface';
import {
  ContextoEmision,
  mapearTipoDocumentoIdentidad,
} from '../services/comprobante-validation.service';
import {
  LineaVentaInput,
  TributosCalculatorService,
} from '../services/tributos-calculator.service';

/** Convierte una venta registrada en la estructura tributaria del comprobante. */
@Injectable()
export class VentaToComprobanteMapper {
  constructor(private readonly calculator: TributosCalculatorService) {}

  map(
    ctx: ContextoEmision,
    documento: DocumentoComprobanteData,
  ): ComprobanteSunatData {
    const { venta, configuracion } = ctx;

    const lineas: LineaVentaInput[] = venta.detalles_ventas.map((d) => {
      const producto = d.productos_presentaciones.productos_comerciales;
      return {
        codigoProducto: producto.codigo_interno ?? producto.sku ?? undefined,
        descripcion: producto.nombre_comercial,
        cantidad: d.cantidad,
        precioUnitarioConIgv: Number(d.precio_unitario_presentacion),
        descuento: Number(d.descuento ?? 0),
        afectoIgv: producto.medicamentos?.afecto_igv ?? true,
      };
    });

    const { items, totales } = this.calculator.calcular(
      lineas,
      documento.moneda,
    );

    const cliente = venta.clientes;
    return {
      emisor: {
        ruc: configuracion.ruc,
        razonSocial: configuracion.razon_social,
        nombreComercial: configuracion.nombre_comercial ?? undefined,
        ubigeo: configuracion.ubigeo ?? undefined,
        direccion: configuracion.direccion_fiscal,
        departamento: configuracion.departamento ?? undefined,
        provincia: configuracion.provincia ?? undefined,
        distrito: configuracion.distrito ?? undefined,
        codigoPais: configuracion.codigo_pais,
      },
      cliente: cliente
        ? {
            tipoDocumento: mapearTipoDocumentoIdentidad(cliente.tipo_documento),
            numeroDocumento: cliente.numero_documento,
            razonSocial: cliente.nombre,
            direccion: cliente.direccion ?? undefined,
          }
        : {
            tipoDocumento: '0',
            numeroDocumento: '0',
            razonSocial: 'CLIENTES VARIOS',
          },
      documento,
      items,
      totales,
    };
  }
}
