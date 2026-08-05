import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SocketAuthService, SocketUser } from './socket-auth.service';
import { createCorsOptions } from '../common/config/cors.config';

export interface UserConnectionInfo {
  socketId: string;
  usuarioId: string;
  nombre: string;
  rol: string;
  boticaId: string;
  sucursalId?: string;
  connectedAt: Date;
}

@Injectable()
@WebSocketGateway({
  cors: createCorsOptions(),
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly connectedUsers = new Map<string, UserConnectionInfo>();

  constructor(private readonly socketAuth: SocketAuthService) {}

  afterInit(server: Server) {
    server.use(async (client: Socket, next) => {
      try {
        await this.socketAuth.authenticate(client);
        next();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'No autorizado';
        next(new Error(message));
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = this.socketAuth.getUser(client);
      await client.join(`botica_${user.boticaId}`);
      if (user.sucursalId) {
        await this.socketAuth.assertSucursalAccess(user, user.sucursalId);
        await client.join(`sucursal_${user.sucursalId}`);
      }
      this.registerConnection(client, user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No autorizado';
      this.logger.warn(
        `[Socket.IO] Conexión rechazada ${client.id}: ${message}`,
      );
      client.emit('auth_error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;
    this.connectedUsers.delete(client.id);
    this.emitConnectedUsers(user.boticaId);
    this.server?.to(`botica_${user.boticaId}`).emit('user.disconnected', {
      usuario_id: user.usuarioId,
      nombre: user.nombre,
    });
  }

  @SubscribeMessage('identify_user')
  async handleIdentifyUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: { sucursalId?: string },
  ) {
    const user = this.socketAuth.getUser(client);
    if (payload?.sucursalId) {
      await this.joinSucursal(client, user, payload.sucursalId);
    }
    return {
      success: true,
      usuarioId: user.id,
      nombre: user.nombre,
      rol: user.rol,
      sucursalId: payload?.sucursalId || user.sucursalId,
    };
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomName: string,
  ) {
    const user = this.socketAuth.getUser(client);
    const match = /^sucursal_([0-9a-f-]{36})$/i.exec(String(roomName || ''));
    if (!match) return { success: false, error: 'Sala no autorizada' };
    await this.joinSucursal(client, user, match[1]);
    return { success: true, room: roomName };
  }

  @SubscribeMessage('join_session')
  handleLegacySession() {
    return {
      success: false,
      error: 'Use el namespace /escanner y una sesión emitida por el servidor',
    };
  }

  @SubscribeMessage('sync_cart')
  handleLegacyCartSync() {
    return { success: false, error: 'Sincronización de carrito no habilitada' };
  }

  emitirASucursal(sucursalId: string, evento: string, data: any): void {
    this.server?.to(`sucursal_${sucursalId}`).emit(evento, data);
  }

  emitirEvento(evento: string, data: any): void {
    this.emitirGlobal(evento, data);
  }

  /**
   * Compatibilidad con llamadas antiguas: solo se emite cuando la carga permite
   * identificar la sucursal. Nunca retransmite datos de tenant globalmente.
   */
  emitirGlobal(evento: string, data: any): void {
    const sucursalId = data?.sucursal_id || data?.sucursalId;
    if (!sucursalId) {
      this.logger.warn(
        `[Socket.IO] Evento ${evento} omitido: no contiene sucursal_id`,
      );
      return;
    }
    this.emitirASucursal(String(sucursalId), evento, data);
  }

  getUsuariosConectados(): UserConnectionInfo[] {
    return Array.from(this.connectedUsers.values());
  }

  private registerConnection(client: Socket, user: SocketUser): void {
    const info: UserConnectionInfo = {
      socketId: client.id,
      usuarioId: user.id,
      nombre: user.nombre,
      rol: user.rol,
      boticaId: user.boticaId,
      sucursalId: user.sucursalId,
      connectedAt: new Date(),
    };
    this.connectedUsers.set(client.id, info);
    this.emitConnectedUsers(user.boticaId);
    this.server?.to(`botica_${user.boticaId}`).emit('user.connected', {
      usuario_id: user.id,
      nombre: user.nombre,
      rol: user.rol,
      sucursal_id: user.sucursalId,
    });
  }

  private async joinSucursal(
    client: Socket,
    user: SocketUser,
    sucursalId: string,
  ): Promise<void> {
    await this.socketAuth.assertSucursalAccess(user, sucursalId);
    const salasAnteriores = Array.from(client.rooms).filter(
      (room) =>
        room.startsWith('sucursal_') && room !== `sucursal_${sucursalId}`,
    );
    await Promise.all(salasAnteriores.map((room) => client.leave(room)));
    await client.join(`sucursal_${sucursalId}`);
    user.sucursalId = sucursalId;
    const info = this.connectedUsers.get(client.id);
    if (info) info.sucursalId = sucursalId;
  }

  private emitConnectedUsers(boticaId: string): void {
    const usuarios = this.getUsuariosConectados().filter(
      (user) => user.boticaId === boticaId,
    );
    this.server?.to(`botica_${boticaId}`).emit('users.active_list', usuarios);
  }
}
