import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const usuarioId = request.user?.id;

    if (!usuarioId) {
      throw new ForbiddenException(
        'No tiene privilegios de administración de plataforma.',
      );
    }

    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        id: usuarioId,
        estado: 'ACTIVO',
        deleted_at: null,
        es_super_admin: true,
      },
      select: { id: true, es_super_admin: true },
    });

    if (!usuario) {
      throw new ForbiddenException(
        'No tiene privilegios de administración de plataforma.',
      );
    }

    request.user.es_super_admin = true;
    return true;
  }
}
