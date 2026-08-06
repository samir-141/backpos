import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let prismaMock: any;

  const BOTICA_ID = 'botica-uuid-1';
  const USER_ID = 'user-uuid-1';

  function mockContext(user: any, boticaId?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          botica_id: boticaId,
        }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    prismaMock = {
      usuarios: {
        findFirst: jest.fn(),
      },
    };

    guard = new PermissionsGuard(reflector, prismaMock);
  });

  it('permite acceso cuando no hay permisos requeridos', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(null);

    const ctx = mockContext({ id: USER_ID, rol: 'CAJERO' }, BOTICA_ID);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('permite acceso cuando el array de permisos está vacío', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);

    const ctx = mockContext({ id: USER_ID, rol: 'CAJERO' }, BOTICA_ID);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('lanza ForbiddenException cuando no hay usuario en la request', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);

    const ctx = mockContext(undefined, BOTICA_ID);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanza ForbiddenException cuando el usuario no tiene id', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);

    const ctx = mockContext({ rol: 'CAJERO' }, BOTICA_ID);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('permite acceso al usuario con rol ADMINISTRADOR', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);

    const ctx = mockContext(
      { id: USER_ID, rol: 'ADMINISTRADOR' },
      BOTICA_ID,
    );
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(prismaMock.usuarios.findFirst).not.toHaveBeenCalled();
  });

  it('permite acceso al usuario con rol GERENTE', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);

    const ctx = mockContext({ id: USER_ID, rol: 'GERENTE' }, BOTICA_ID);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('permite acceso al usuario con rol PROPIETARIO', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);

    const ctx = mockContext(
      { id: USER_ID, rol: 'PROPIETARIO' },
      BOTICA_ID,
    );
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('permite acceso cuando el rol contiene ADMIN (ej: ADMINISTRADOR)', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);

    const ctx = mockContext(
      { id: USER_ID, rol: 'SUPER_ADMIN' },
      BOTICA_ID,
    );
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('lanza ForbiddenException cuando no hay botica_id', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);

    const ctx = mockContext(
      { id: USER_ID, rol: 'CAJERO' },
      undefined,
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanza ForbiddenException cuando el usuario no existe en la BD', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);
    prismaMock.usuarios.findFirst.mockResolvedValue(null);

    const ctx = mockContext(
      { id: USER_ID, rol: 'CAJERO' },
      BOTICA_ID,
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanza ForbiddenException cuando el usuario no tiene rol', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);
    prismaMock.usuarios.findFirst.mockResolvedValue({
      id: USER_ID,
      roles: null,
    });

    const ctx = mockContext(
      { id: USER_ID, rol: 'CAJERO' },
      BOTICA_ID,
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('permite acceso cuando el usuario tiene todos los permisos requeridos', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.ver',
      'ventas.crear',
    ]);
    prismaMock.usuarios.findFirst.mockResolvedValue({
      id: USER_ID,
      roles: {
        rol_permisos: [
          {
            permisos: {
              codigo: 'ventas.ver',
              deleted_at: null,
            },
          },
          {
            permisos: {
              codigo: 'ventas.crear',
              deleted_at: null,
            },
          },
          {
            permisos: {
              codigo: 'inventario.ver',
              deleted_at: null,
            },
          },
        ],
      },
    });

    const ctx = mockContext(
      { id: USER_ID, rol: 'CAJERO' },
      BOTICA_ID,
    );
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('lanza ForbiddenException cuando el usuario no tiene todos los permisos', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
      'ventas.anular',
    ]);
    prismaMock.usuarios.findFirst.mockResolvedValue({
      id: USER_ID,
      roles: {
        rol_permisos: [
          {
            permisos: {
              codigo: 'ventas.crear',
              deleted_at: null,
            },
          },
        ],
      },
    });

    const ctx = mockContext(
      { id: USER_ID, rol: 'CAJERO' },
      BOTICA_ID,
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanza ForbiddenException cuando el permiso está soft-deleted', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.crear',
    ]);
    prismaMock.usuarios.findFirst.mockResolvedValue({
      id: USER_ID,
      roles: {
        rol_permisos: [
          {
            permisos: {
              codigo: 'ventas.crear',
              deleted_at: new Date(),
            },
          },
        ],
      },
    });

    const ctx = mockContext(
      { id: USER_ID, rol: 'CAJERO' },
      BOTICA_ID,
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('usa botica_id del request si no está en user', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.ver',
    ]);
    prismaMock.usuarios.findFirst.mockResolvedValue({
      id: USER_ID,
      roles: {
        rol_permisos: [
          {
            permisos: {
              codigo: 'ventas.ver',
              deleted_at: null,
            },
          },
        ],
      },
    });

    const ctx = mockContext(
      { id: USER_ID, rol: 'CAJERO' },
      BOTICA_ID,
    );
    await guard.canActivate(ctx);

    expect(prismaMock.usuarios.findFirst).toHaveBeenCalledWith({
      where: {
        id: USER_ID,
        botica_id: BOTICA_ID,
        deleted_at: null,
        estado: 'ACTIVO',
      },
      include: expect.any(Object),
    });
  });

  it('usa botica_id de user cuando request.botica_id es undefined', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'ventas.ver',
    ]);
    prismaMock.usuarios.findFirst.mockResolvedValue({
      id: USER_ID,
      roles: {
        rol_permisos: [
          {
            permisos: {
              codigo: 'ventas.ver',
              deleted_at: null,
            },
          },
        ],
      },
    });

    const ctx = mockContext({
      id: USER_ID,
      rol: 'CAJERO',
      botica_id: BOTICA_ID,
    });
    await guard.canActivate(ctx);

    expect(prismaMock.usuarios.findFirst).toHaveBeenCalledWith({
      where: {
        id: USER_ID,
        botica_id: BOTICA_ID,
        deleted_at: null,
        estado: 'ACTIVO',
      },
      include: expect.any(Object),
    });
  });
});
