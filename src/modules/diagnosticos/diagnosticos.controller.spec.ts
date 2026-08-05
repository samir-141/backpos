import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PlatformAdminGuard } from '../../auth/guards/platform-admin.guard';
import { DiagnosticosController } from './diagnosticos.controller';

describe('DiagnosticosController security', () => {
  it('declara el guard de plataforma en todo el controlador', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, DiagnosticosController);
    expect(guards).toContain(PlatformAdminGuard);
  });

  it('responde 403 para un usuario que no es administrador de plataforma', async () => {
    const prisma = {
      usuarios: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const guard = new PlatformAdminGuard(prisma);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'usuario-tenant' } }),
      }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
