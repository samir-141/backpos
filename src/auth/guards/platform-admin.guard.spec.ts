import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

function contexto(user: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PlatformAdminGuard', () => {
  it('rechaza a un administrador de botica sin privilegio de plataforma', async () => {
    const prisma = {
      usuarios: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const guard = new PlatformAdminGuard(prisma as any);

    await expect(
      guard.canActivate(contexto({ id: 'tenant-admin', rol: 'ADMINISTRADOR' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.usuarios.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'tenant-admin',
        estado: 'ACTIVO',
        deleted_at: null,
        es_super_admin: true,
      },
      select: { id: true, es_super_admin: true },
    });
  });

  it('permite a un superadministrador activo revalidado en base de datos', async () => {
    const prisma = {
      usuarios: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'platform-admin', es_super_admin: true }),
      },
    };
    const guard = new PlatformAdminGuard(prisma as any);

    await expect(
      guard.canActivate(contexto({ id: 'platform-admin' })),
    ).resolves.toBe(true);
  });
});
