import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('No autorizado: usuario no identificado');
    }

    const userRol = String(user.rol || '').toUpperCase();
    const isAdmin =
      userRol.includes('ADMIN') ||
      userRol === 'PROPIETARIO' ||
      userRol === 'GERENTE';

    if (isAdmin) {
      return true;
    }

    const boticaId = request.botica_id || user.botica_id;

    if (!boticaId) {
      throw new ForbiddenException(
        'No autorizado: no se puede determinar la botica',
      );
    }

    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        id: user.id,
        botica_id: boticaId,
        deleted_at: null,
        estado: 'ACTIVO',
      },
      include: {
        roles: {
          include: {
            rol_permisos: {
              include: { permisos: true },
            },
          },
        },
      },
    });

    if (!usuario || !usuario.roles) {
      throw new ForbiddenException('No autorizado: usuario no encontrado');
    }

    const userPermissions = new Set<string>();
    for (const rp of usuario.roles.rol_permisos) {
      if (rp.permisos && rp.permisos.deleted_at === null) {
        userPermissions.add(rp.permisos.codigo);
      }
    }

    const hasAll = required.every((p) => userPermissions.has(p));

    if (!hasAll) {
      throw new ForbiddenException(
        `No tienes permiso para esta acción. Permisos requeridos: ${required.join(', ')}`,
      );
    }

    return true;
  }
}
