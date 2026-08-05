import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SocketAuthService } from './socket-auth.service';

function socket(token?: string): Socket {
  return {
    handshake: { auth: token ? { token } : {}, headers: {} },
    data: {},
  } as unknown as Socket;
}

describe('SocketAuthService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });

  it('rechaza sockets sin token', async () => {
    const prisma = { usuarios: { findFirst: jest.fn() } } as any;
    const service = new SocketAuthService(jwt, prisma);

    await expect(service.authenticate(socket())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.usuarios.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza un token cuyo tenant no coincide con el usuario', async () => {
    const prisma = {
      usuarios: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          nombre: 'Cajero',
          botica_id: 'botica-real',
          estado: 'ACTIVO',
          deleted_at: null,
          es_super_admin: false,
          roles: { nombre: 'CAJERO' },
        }),
      },
    } as any;
    const service = new SocketAuthService(jwt, prisma);
    const token = jwt.sign({ sub: 'user-1', botica_id: 'otra-botica' });

    await expect(service.authenticate(socket(token))).rejects.toThrow(
      'El token no pertenece a la botica del usuario',
    );
  });
});
