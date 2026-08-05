import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly eventsGateway: EventsGateway) {}

  /**
   * Notifica la creación de una nueva venta en tiempo real
   */
  notificarVentaCreada(sucursalId: string, ventaPayload: any) {
    this.logger.log(
      `[Realtime] Notificando venta.creada en sucursal ${sucursalId}`,
    );
    this.eventsGateway.emitirASucursal(
      sucursalId,
      'venta.creada',
      ventaPayload,
    );
    this.eventsGateway.emitirGlobal('dashboard.actualizado', {
      sucursal_id: sucursalId,
    });
  }

  /**
   * Notifica la anulación de una venta
   */
  notificarVentaAnulada(sucursalId: string, ventaId: string) {
    this.logger.log(`[Realtime] Notificando venta.anulada ID: ${ventaId}`);
    this.eventsGateway.emitirASucursal(sucursalId, 'venta.anulada', {
      venta_id: ventaId,
    });
    this.eventsGateway.emitirGlobal('dashboard.actualizado', {
      sucursal_id: sucursalId,
    });
  }

  /**
   * Notifica cambio de stock en tiempo real
   */
  notificarStockActualizado(
    sucursalId: string,
    productoComercialId: string,
    nuevoStockTotal: number,
  ) {
    this.logger.log(
      `[Realtime] Notificando stock.actualizado para ${productoComercialId}: ${nuevoStockTotal}`,
    );
    this.eventsGateway.emitirASucursal(sucursalId, 'stock.actualizado', {
      producto_comercial_id: productoComercialId,
      stock_total: nuevoStockTotal,
    });
  }

  /**
   * Notifica alerta de stock mínimo o agotado
   */
  notificarAlertaStock(
    sucursalId: string,
    productoNombre: string,
    stockActual: number,
  ) {
    const tipo = stockActual <= 0 ? 'stock.out' : 'stock.minimum';
    const mensaje =
      stockActual <= 0
        ? `El producto "${productoNombre}" se ha AGOTADO en la sucursal.`
        : `El producto "${productoNombre}" alcanzó stock mínimo (${stockActual} unids).`;

    this.logger.warn(`[Realtime Alerta] ${mensaje}`);
    this.eventsGateway.emitirASucursal(sucursalId, tipo, {
      producto_nombre: productoNombre,
      stock_actual: stockActual,
      mensaje,
    });
    this.eventsGateway.emitirASucursal(sucursalId, 'notification.created', {
      titulo: stockActual <= 0 ? 'Stock Agotado' : 'Alerta de Stock Mínimo',
      mensaje,
      tipo: stockActual <= 0 ? 'DANGER' : 'WARNING',
    });
  }

  /**
   * Notifica la apertura de caja de un turno
   */
  notificarCajaAperturada(
    sucursalId: string,
    cajaId: string,
    usuarioId: string,
    montoInicial: number,
  ) {
    this.logger.log(`[Realtime] Notificando caja.aperturada ID: ${cajaId}`);
    this.eventsGateway.emitirASucursal(sucursalId, 'caja.aperturada', {
      caja_id: cajaId,
      usuario_id: usuarioId,
      monto_inicial: montoInicial,
    });
  }

  /**
   * Notifica el Cierre Z de caja de un turno
   */
  notificarCajaCerrada(sucursalId: string, cajaId: string, resumenCierre: any) {
    this.logger.log(`[Realtime] Notificando caja.cerrada ID: ${cajaId}`);
    this.eventsGateway.emitirASucursal(sucursalId, 'caja.cerrada', {
      caja_id: cajaId,
      resumen: resumenCierre,
    });
  }

  /**
   * Notifica actualización general de productos
   */
  notificarProductoCambio(
    sucursalId: string,
    accion: 'creado' | 'actualizado' | 'eliminado',
    producto: any,
  ) {
    this.logger.log(`[Realtime] Notificando producto.${accion}`);
    this.eventsGateway.emitirASucursal(
      sucursalId,
      `producto.${accion}`,
      producto,
    );
  }

  /**
   * Notifica una alerta o mensaje al sistema
   */
  notificarGeneral(payload: {
    titulo: string;
    mensaje: string;
    tipo: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
    sucursalId?: string;
  }) {
    if (payload.sucursalId) {
      this.eventsGateway.emitirASucursal(
        payload.sucursalId,
        'notification.created',
        payload,
      );
    } else {
      this.eventsGateway.emitirGlobal('notification.created', payload);
    }
  }
}
