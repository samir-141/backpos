import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.rol) {
      throw new ForbiddenException('No autorizado: usuario sin rol');
    }

    const userRol = String(user.rol).toUpperCase();
    const isAdmin =
      userRol.includes('ADMIN') ||
      userRol === 'PROPIETARIO' ||
      userRol === 'GERENTE';

    const hasRequiredRole = required.some((r) => userRol === r.toUpperCase());

    if (isAdmin || hasRequiredRole) {
      return true;
    }

    throw new ForbiddenException('No tienes permisos para esta acción');
  }
}