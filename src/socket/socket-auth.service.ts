import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

export interface SocketUser {
  id: string;
  nombre: string;
  rol: string;
  boticaId: string;
  sucursalId?: string;
  esSuperAdmin: boolean;
}

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticate(client: Socket): Promise<SocketUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    let payload: Record<string, any>;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token de acceso inválido');
    }

    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        id: String(payload.sub),
        estado: 'ACTIVO',
        deleted_at: null,
      },
      include: { roles: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario inactivo o no autorizado');
    }

    if (payload.botica_id && payload.botica_id !== usuario.botica_id) {
      throw new UnauthorizedException(
        'El token no pertenece a la botica del usuario',
      );
    }

    const socketUser: SocketUser = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.roles?.nombre || 'SIN_ROL',
      boticaId: usuario.botica_id,
      sucursalId: payload.sucursal_id ? String(payload.sucursal_id) : undefined,
      esSuperAdmin: Boolean(usuario.es_super_admin),
    };
    client.data.user = socketUser;
    return socketUser;
  }

  getUser(client: Socket): SocketUser {
    const user = client.data.user as SocketUser | undefined;
    if (!user) {
      throw new UnauthorizedException('Socket no autenticado');
    }
    return user;
  }

  async assertSucursalAccess(
    user: SocketUser,
    sucursalId: string,
  ): Promise<void> {
    const sucursal = await this.prisma.sucursales.findFirst({
      where: {
        id: sucursalId,
        deleted_at: null,
        ...(user.esSuperAdmin ? {} : { botica_id: user.boticaId }),
      },
      select: { id: true, botica_id: true },
    });
    if (!sucursal) {
      throw new UnauthorizedException('Sucursal no autorizada');
    }

    if (user.esSuperAdmin) return;

    const asignacion = await this.prisma.usuario_sucursales.findFirst({
      where: {
        usuario_id: user.id,
        sucursal_id: sucursalId,
        botica_id: user.boticaId,
        activo: true,
      },
      select: { usuario_id: true },
    });
    if (!asignacion) {
      throw new UnauthorizedException(
        'El usuario no pertenece a la sucursal solicitada',
      );
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    const rawHeader = client.handshake.headers?.authorization;
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const token = typeof authToken === 'string' ? authToken : header;
    if (!token) return undefined;
    return token.replace(/^Bearer\s+/i, '').trim() || undefined;
  }
}
