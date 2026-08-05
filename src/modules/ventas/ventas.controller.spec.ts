import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { VentasController } from './ventas.controller';

describe('VentasController autorización de anulación', () => {
  const guard = new RolesGuard(new Reflector());
  const context = (rol: string): any => ({
    getHandler: () => VentasController.prototype.anular,
    getClass: () => VentasController,
    switchToHttp: () => ({ getRequest: () => ({ user: { rol } }) }),
  });

  it.each(['ADMINISTRADOR', 'GERENTE', 'FARMACÉUTICO'])(
    'permite anular a %s',
    (rol) => expect(guard.canActivate(context(rol))).toBe(true),
  );

  it.each(['CAJERO', 'VENDEDOR', 'CONTADOR', 'ALMACENERO'])(
    'rechaza anulación para %s',
    (rol) =>
      expect(() => guard.canActivate(context(rol))).toThrow(ForbiddenException),
  );
});
