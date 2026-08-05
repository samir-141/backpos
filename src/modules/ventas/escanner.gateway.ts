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
import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from '../../socket/socket-auth.service';
import { createCorsOptions } from '../../common/config/cors.config';

interface ScannerSession {
  code: string;
  boticaId: string;
  ownerSocketId: string;
  phoneSocketId?: string;
  expiresAt: number;
  consumed: boolean;
}

@WebSocketGateway({
  cors: createCorsOptions(),
  namespace: 'escanner',
})
export class EscannerGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EscannerGateway.name);
  private readonly sessions = new Map<string, ScannerSession>();
  private readonly socketSessionMap = new Map<string, string>();
  private readonly sessionTtlMs = 5 * 60 * 1000;

  constructor(private readonly socketAuth: SocketAuthService) {}

  afterInit(server: Server) {
    server.use(async (client: Socket, next) => {
      try {
        await this.socketAuth.authenticate(client);
        next();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No autorizado';
        next(new Error(message));
      }
    });
  }

  handleConnection(client: Socket): void {
    const user = this.socketAuth.getUser(client);
    console.log(`[EscannerGateway] Conexión establecida y autenticada para: ${user.nombre} (${client.id})`);
  }

  handleDisconnect(client: Socket): void {
    console.log(`[EscannerGateway] Dispositivo desconectado: ${client.id}`);
    const code = this.socketSessionMap.get(client.id);
    this.socketSessionMap.delete(client.id);
    if (!code) return;

    const session = this.sessions.get(code);
    if (!session) return;
    this.sessions.delete(code);
    this.server?.to(code).emit('device_disconnected', {
      socketId: client.id,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('create_session')
  createSession(@ConnectedSocket() client: Socket) {
    console.log(`[EscannerGateway] Recibido 'create_session' de: ${client.id}`);
    try {
      const user = this.socketAuth.getUser(client);
      console.log(`[EscannerGateway] Usuario obtenido para sesión:`, user);
      this.removeSessionForSocket(client.id);

      const code = randomBytes(18).toString('base64url').toUpperCase();
      const session: ScannerSession = {
        code,
        boticaId: user.boticaId,
        ownerSocketId: client.id,
        expiresAt: Date.now() + this.sessionTtlMs,
        consumed: false,
      };
      this.sessions.set(code, session);
      this.socketSessionMap.set(client.id, code);
      void client.join(code);

      console.log(`[EscannerGateway] Sesión creada con éxito. Código: ${code}`);
      return { success: true, sessionCode: code, expiresAt: session.expiresAt };
    } catch (err) {
      console.error(`[EscannerGateway] Error al crear sesión:`, err);
      throw err;
    }
  }

  @SubscribeMessage('join_session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { sessionCode?: string; role?: 'pc' | 'phone'; deviceName?: string },
  ) {
    if (data?.role === 'pc') {
      return this.createSession(client);
    }

    const user = this.socketAuth.getUser(client);
    const code = this.normalizeCode(data?.sessionCode);
    const session = code ? this.sessions.get(code) : undefined;
    if (!session) return { success: false, error: 'Sesión no existe' };
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(code);
      return { success: false, error: 'Sesión expirada' };
    }
    if (session.boticaId !== user.boticaId) {
      return { success: false, error: 'Sesión de otra botica' };
    }
    if (session.consumed) {
      return { success: false, error: 'Código de sesión ya utilizado' };
    }

    session.consumed = true;
    session.phoneSocketId = client.id;
    this.socketSessionMap.set(client.id, code);
    void client.join(code);
    client.to(code).emit('device_joined', {
      socketId: client.id,
      role: 'phone',
      deviceName: data?.deviceName || 'Smartphone Remoto',
      timestamp: Date.now(),
    });
    return { success: true, sessionCode: code };
  }

  @SubscribeMessage('scan_barcode')
  handleScanBarcode(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { sessionCode?: string; barcode?: string; deviceName?: string },
  ) {
    const code = this.normalizeCode(data?.sessionCode);
    const barcode = String(data?.barcode || '').trim();
    const mappedCode = this.socketSessionMap.get(client.id);
    const session = code ? this.sessions.get(code) : undefined;

    if (!code || !barcode || mappedCode !== code || !session) {
      return { success: false, error: 'Sesión o código inválido' };
    }
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(code);
      return { success: false, error: 'Sesión expirada' };
    }
    if (session.phoneSocketId !== client.id) {
      return { success: false, error: 'Dispositivo no emparejado' };
    }

    this.server?.to(code).emit('barcode_scanned', {
      barcode,
      deviceName: data?.deviceName || 'Smartphone Remoto',
      timestamp: Date.now(),
    });
    return { success: true, status: 'OK', barcode };
  }

  @SubscribeMessage('ping_check')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { timestamp?: number },
  ) {
    this.socketAuth.getUser(client);
    return {
      pong: true,
      clientTimestamp: data?.timestamp || Date.now(),
      serverTimestamp: Date.now(),
    };
  }

  private normalizeCode(value?: string): string {
    return String(value || '')
      .toUpperCase()
      .trim();
  }

  private removeSessionForSocket(socketId: string): void {
    const previousCode = this.socketSessionMap.get(socketId);
    if (previousCode) this.sessions.delete(previousCode);
    this.socketSessionMap.delete(socketId);
  }
}
