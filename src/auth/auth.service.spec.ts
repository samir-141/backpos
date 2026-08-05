import { AuthService } from './auth.service';

describe('AuthService tenant scope', () => {
  it('un administrador tenant solo carga sucursales de su propia botica', async () => {
    const prisma = {
      usuario_sucursales: { findMany: jest.fn().mockResolvedValue([]) },
      sucursales: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sucursal-a',
            nombre: 'Sucursal A',
            botica_id: 'botica-a',
            boticas: { id: 'botica-a', razon_social: 'Botica A' },
          },
        ]),
      },
    };
    const jwt = { sign: jest.fn().mockReturnValue('token') };
    const service = new AuthService(prisma as any, jwt as any);

    const respuesta = await service.login({
      id: 'admin-a',
      botica_id: 'botica-a',
      nombre: 'Admin A',
      correo: 'admin-a@example.test',
      roles: { nombre: 'ADMINISTRADOR' },
      es_super_admin: false,
    });

    expect(prisma.sucursales.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { botica_id: 'botica-a', deleted_at: null },
      }),
    );
    expect(respuesta.sucursales_disponibles).toHaveLength(1);
    expect(respuesta.sucursales_disponibles[0].botica_id).toBe('botica-a');
  });
});
