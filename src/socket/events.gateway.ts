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
import { Logger, Injectable } from '@nestjs/common';

export interface UserConnectionInfo {
  socketId: string;
  usuarioId: string;
  nombre: string;
  rol: string;
  sucursalId: string;
  connectedAt: Date;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly connectedUsers = new Map<string, UserConnectionInfo>();

  handleConnection(client: Socket) {
    this.logger.log(`[Socket.IO] Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.logger.log(`[Socket.IO] Usuario ${user.nombre} (${user.rol}) desconectado`);
      this.connectedUsers.delete(client.id);
      this.emitirUsuariosConectados();
      this.emitirGlobal('user.disconnected', {
        usuario_id: user.usuarioId,
        nombre: user.nombre,
      });
    } else {
      this.logger.log(`[Socket.IO] Cliente desconectado: ${client.id}`);
    }
  }

  /**
   * Identificación del usuario y suscripción a su sala de sucursal
   */
  @SubscribeMessage('identify_user')
  handleIdentifyUser(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      usuarioId: string;
      nombre: string;
      rol?: string;
      sucursalId?: string;
    },
  ) {
    if (payload && payload.usuarioId) {
      const info: UserConnectionInfo = {
        socketId: client.id,
        usuarioId: payload.usuarioId,
        nombre: payload.nombre || 'Usuario POS',
        rol: payload.rol || 'CAJERO',
        sucursalId: payload.sucursalId || 'GLOBAL',
        connectedAt: new Date(),
      };

      this.connectedUsers.set(client.id, info);

      if (payload.sucursalId) {
        const roomName = `sucursal_${payload.sucursalId}`;
        client.join(roomName);
        this.logger.log(
          `[Socket.IO] Usuario ${info.nombre} unió a sala ${roomName}`,
        );
      }

      this.emitirUsuariosConectados();
      this.emitirGlobal('user.connected', {
        usuario_id: info.usuarioId,
        nombre: info.nombre,
        rol: info.rol,
        sucursal_id: info.sucursalId,
      });
    }
  }

  /**
   * Unión manual a salas por sucursal o sesión de escáner
   */
  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomName: string,
  ) {
    if (roomName) {
      client.join(roomName);
      this.logger.log(`[Socket.IO] Cliente ${client.id} se unió a ${roomName}`);
    }
  }

  @SubscribeMessage('join_session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() sessionCode: string,
  ) {
    if (sessionCode) {
      const room = `session_${sessionCode.toUpperCase()}`;
      client.join(room);
      this.logger.log(`[Socket.IO] Cliente ${client.id} se unió a ${room}`);
    }
  }

  @SubscribeMessage('sync_cart')
  handleSyncCart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionCode: string; cart: any[] },
  ) {
    if (payload && payload.sessionCode) {
      const room = `session_${payload.sessionCode.toUpperCase()}`;
      client.to(room).emit('carrito.actualizado', payload.cart);
      this.logger.log(`[Socket.IO] Carrito transmitido a ${room}`);
    }
  }

  /**
   * Emite evento a todos los clientes conectados a una sucursal específica
   */
  emitirASucursal(sucursalId: string, evento: string, data: any) {
    this.logger.log(`[Socket.IO Sucursal: ${sucursalId}] Evento: ${evento}`);
    if (this.server) {
      this.server.to(`sucursal_${sucursalId}`).emit(evento, data);
      // También emite global por compatibilidad
      this.server.emit(evento, data);
    }
  }

  /**
   * Emite evento a nivel global (Alias de compatibilidad)
   */
  emitirEvento(evento: string, data: any) {
    this.emitirGlobal(evento, data);
  }

  /**
   * Emite evento a nivel global
   */
  emitirGlobal(evento: string, data: any) {
    this.logger.log(`[Socket.IO Global] Evento: ${evento}`);
    this.server?.emit(evento, data);
  }

  /**
   * Retorna la lista activa de usuarios conectados
   */
  getUsuariosConectados(): UserConnectionInfo[] {
    return Array.from(this.connectedUsers.values());
  }

  private emitirUsuariosConectados() {
    const usuarios = this.getUsuariosConectados();
    this.server?.emit('users.active_list', usuarios);
  }
}
