import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ProductosController } from './productos.controller';
import { GastosAdminGuard } from '../gastos/gastos.controller';
import { CajasController } from '../cajas/cajas.controller';

function context(controller: any, method: string, rol: string): any {
  return {
    getHandler: () => controller.prototype[method],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: { rol } }) }),
  };
}

describe('Matriz de roles operativos', () => {
  const guard = new RolesGuard(new Reflector());

  it.each([
    [ProductosController, 'findAll', 'CAJERO', true],
    [ProductosController, 'create', 'FARMACÉUTICO', true],
    [ProductosController, 'reabastecer', 'ALMACENERO', true],
    [ProductosController, 'create', 'CAJERO', false],
    [CajasController, 'aperturar', 'CAJERO', true],
    [CajasController, 'cerrar', 'CONTADOR', false],
  ])('%s.%s para %s => %s', (controller, method, rol, allowed) => {
    const action = () => guard.canActivate(context(controller, method, rol));
    if (allowed) expect(action()).toBe(true);
    else expect(action).toThrow(ForbiddenException);
  });

  it.each([
    ['ADMINISTRADOR', true],
    ['GERENTE', false],
    ['CAJERO', false],
  ])('gastos para %s => %s', (rol, allowed) => {
    const gastosGuard = new GastosAdminGuard();
    const action = () =>
      gastosGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ user: { rol } }) }),
      } as any);
    if (allowed) expect(action()).toBe(true);
    else expect(action).toThrow(ForbiddenException);
  });
});
