import { Socket } from 'socket.io';
import { EventsGateway } from './events.gateway';

describe('EventsGateway cambio de sucursal', () => {
  it('revalida acceso, abandona salas anteriores y une solo la nueva', async () => {
    const user = {
      id: 'usuario-1',
      nombre: 'Cajero',
      rol: 'CAJERO',
      boticaId: 'botica-1',
      sucursalId: '11111111-1111-4111-8111-111111111111',
      esSuperAdmin: false,
    };
    const auth = {
      getUser: jest.fn().mockReturnValue(user),
      assertSucursalAccess: jest.fn().mockResolvedValue(undefined),
    } as any;
    const rooms = new Set([
      'socket-1',
      'botica_botica-1',
      'sucursal_11111111-1111-4111-8111-111111111111',
      'sucursal_22222222-2222-4222-8222-222222222222',
    ]);
    const client = {
      id: 'socket-1',
      data: { user },
      rooms,
      leave: jest.fn(async (room: string) => rooms.delete(room)),
      join: jest.fn(async (room: string) => rooms.add(room)),
    } as unknown as Socket;
    const gateway = new EventsGateway(auth);
    const target = '33333333-3333-4333-8333-333333333333';

    await gateway.handleJoinRoom(client, `sucursal_${target}`);

    expect(auth.assertSucursalAccess).toHaveBeenCalledWith(user, target);
    expect(
      Array.from(rooms).filter((room) => room.startsWith('sucursal_')),
    ).toEqual([`sucursal_${target}`]);
    expect(auth.assertSucursalAccess.mock.invocationCallOrder[0]).toBeLessThan(
      (client.leave as jest.Mock).mock.invocationCallOrder[0],
    );
  });
});
