// src/socket/events.gateway.ts
// Gateway WebSocket de eventos centralizados del Backend
// (Secciones 21 y 22 del Documento 02 de Arquitectura)

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, Injectable } from "@nestjs/common";

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`[Socket] Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Socket] Cliente desconectado: ${client.id}`);
  }

  // --- Unión a salas por sesión o sucursal ---
  @SubscribeMessage("join_session")
  handleJoinSession(@ConnectedSocket() client: Socket, @MessageBody() sessionCode: string) {
    if (sessionCode) {
      const room = `session_${sessionCode.toUpperCase()}`;
      client.join(room);
      this.logger.log(`[Socket] Cliente ${client.id} se unió a sala ${room}`);
    }
  }

  // --- Sincronización del Carrito Compartido en Tiempo Real ---
  @SubscribeMessage("sync_cart")
  handleSyncCart(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionCode: string; cart: any[] }) {
    if (payload && payload.sessionCode) {
      const room = `session_${payload.sessionCode.toUpperCase()}`;
      client.to(room).emit("carrito.actualizado", payload.cart);
      this.logger.log(`[Socket] Carrito transmitido en sala ${room}`);
    }
  }

  // --- Emisión de eventos globales del sistema ---
  emitirEvento(evento: string, data: any) {
    this.logger.log(`[Socket.IO Emit] Evento: ${evento}`);
    this.server.emit(evento, data);
  }
}
