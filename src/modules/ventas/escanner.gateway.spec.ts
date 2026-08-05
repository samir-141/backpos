import { Socket } from 'socket.io';
import { EscannerGateway } from './escanner.gateway';

function client(id: string, boticaId: string): Socket {
  return {
    id,
    data: { user: { id, boticaId } },
    join: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  } as unknown as Socket;
}

describe('EscannerGateway', () => {
  const auth = {
    authenticate: jest.fn(),
    getUser: jest.fn((socket: Socket) => socket.data.user),
  } as any;

  afterEach(() => jest.restoreAllMocks());

  it('rechaza el emparejamiento cuando la sesión expiró', () => {
    const gateway = new EscannerGateway(auth);
    const pc = client('pc-1', 'botica-1');
    const phone = client('phone-1', 'botica-1');
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const created = gateway.createSession(pc);
    jest.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 1);
    const result = gateway.handleJoinSession(phone, {
      sessionCode: created.sessionCode,
      role: 'phone',
    });

    expect(result).toEqual({ success: false, error: 'Sesión expirada' });
  });

  it('impide usar un código de emparejamiento por segunda vez', () => {
    const gateway = new EscannerGateway(auth);
    const pc = client('pc-1', 'botica-1');
    const firstPhone = client('phone-1', 'botica-1');
    const secondPhone = client('phone-2', 'botica-1');
    const created = gateway.createSession(pc);

    expect(
      gateway.handleJoinSession(firstPhone, {
        sessionCode: created.sessionCode,
        role: 'phone',
      }),
    ).toMatchObject({ success: true });
    expect(
      gateway.handleJoinSession(secondPhone, {
        sessionCode: created.sessionCode,
        role: 'phone',
      }),
    ).toEqual({ success: false, error: 'Código de sesión ya utilizado' });
  });
});
