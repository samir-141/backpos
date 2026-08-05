import { ForbiddenException } from '@nestjs/common';
import { GastosController } from './gastos.controller';

describe('GastosController sucursal', () => {
  it('no lista gastos de una sucursal no asignada', async () => {
    const service = { listar: jest.fn() } as any;
    const prisma = {
      usuario_sucursales: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const controller = new GastosController(service, prisma);
    const request = {
      botica_id: 'botica-1',
      user: {
        id: 'usuario-1',
        rol: 'ADMINISTRADOR',
        sucursal_id: 'sucursal-1',
      },
    };

    await expect(
      controller.listar(request, 'sucursal-ajena'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.listar).not.toHaveBeenCalled();
  });
});
