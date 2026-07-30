import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'escanner',
})
export class EscannerGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('EscannerGateway');
  // Guarda mapeo de socketId -> sessionCode
  private readonly socketSessionMap = new Map<string, string>();

  handleConnection(client: Socket) {
    this.logger.log(`📱 Cliente conectado a escáner gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const sessionCode = this.socketSessionMap.get(client.id);
    if (sessionCode) {
      this.socketSessionMap.delete(client.id);
      this.server.to(sessionCode).emit('device_disconnected', {
        socketId: client.id,
        timestamp: Date.now(),
      });
      this.logger.log(
        `📱 Cliente desconectado de sesión [${sessionCode}]: ${client.id}`,
      );
    }
  }

  @SubscribeMessage('join_session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { sessionCode: string; role?: 'pc' | 'phone'; deviceName?: string },
  ) {
    const sessionCode = String(data.sessionCode || '')
      .toUpperCase()
      .trim();
    if (!sessionCode)
      return { success: false, error: 'Código de sesión inválido' };

    client.join(sessionCode);
    this.socketSessionMap.set(client.id, sessionCode);

    this.logger.log(
      `🔗 [${data.role || 'device'}] unido a sala: ${sessionCode} (${data.deviceName || client.id})`,
    );

    // Notificar a otros dispositivos en la sala que se unió alguien
    client.to(sessionCode).emit('device_joined', {
      socketId: client.id,
      role: data.role || 'phone',
      deviceName: data.deviceName || 'Smartphone Remoto',
      timestamp: Date.now(),
    });

    return { success: true, sessionCode };
  }

  @SubscribeMessage('scan_barcode')
  handleScanBarcode(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { sessionCode: string; barcode: string; deviceName?: string },
  ) {
    const sessionCode = String(data.sessionCode || '')
      .toUpperCase()
      .trim();
    const barcode = String(data.barcode || '').trim();

    if (!sessionCode || !barcode) return;

    this.logger.log(
      `⚡ Código [${barcode}] transmitido en sesión [${sessionCode}] por ${data.deviceName || client.id}`,
    );

    // Retransmitir inmediatamente a todos en la sesión (incluido PC POS)
    this.server.to(sessionCode).emit('barcode_scanned', {
      barcode,
      deviceName: data.deviceName || 'Smartphone Inalámbrico',
      timestamp: Date.now(),
    });

    return { status: 'OK', barcode };
  }

  @SubscribeMessage('ping_check')
  handlePing(@MessageBody() data: { timestamp: number }) {
    return {
      pong: true,
      clientTimestamp: data?.timestamp || Date.now(),
      serverTimestamp: Date.now(),
    };
  }
}
