import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdministracionGeneralService } from './administracion-general.service';
import { PaginationQueryDto } from './dto/administracion-general.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

function serviceWith(prisma: object) {
  return new AdministracionGeneralService(prisma as PrismaService);
}

describe('AdministracionGeneralService tenant ownership', () => {
  it('no actualiza una sucursal que no pertenece a la botica de la ruta', async () => {
    const prisma = {
      sucursales: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.actualizarSucursal('botica-a', 'sucursal-b', {
        nombre: 'Intento cruzado',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.sucursales.update).not.toHaveBeenCalled();
  });

  it('no archiva un colaborador que no pertenece a la botica de la ruta', async () => {
    const prisma = {
      usuarios: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = serviceWith(prisma);

    await expect(
      service.archivarColaborador('botica-a', 'usuario-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('preserva todas las asignaciones cuando una edición no envía sucursal_ids', async () => {
    const tx = {
      usuarios: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'usuario-a' }),
      },
      usuario_sucursales: {
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      sucursales: { findMany: jest.fn() },
    };
    const prisma = {
      usuarios: { findFirst: jest.fn().mockResolvedValue({ id: 'usuario-a' }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = serviceWith(prisma);

    await service.actualizarColaborador('botica-a', 'usuario-a', {
      nombre: 'Nombre editado',
    });

    expect(tx.usuarios.update).toHaveBeenCalledWith({
      where: { id: 'usuario-a' },
      data: { nombre: 'Nombre editado' },
    });
    expect(tx.sucursales.findMany).not.toHaveBeenCalled();
    expect(tx.usuario_sucursales.findMany).not.toHaveBeenCalled();
    expect(tx.usuario_sucursales.update).not.toHaveBeenCalled();
    expect(tx.usuario_sucursales.create).not.toHaveBeenCalled();
  });

  it('aplica un diff multi-sucursal conservando la principal retenida', async () => {
    const tx = {
      sucursales: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'sucursal-a' }, { id: 'sucursal-c' }]),
      },
      usuarios: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'usuario-a' }),
      },
      usuario_sucursales: {
        findMany: jest.fn().mockResolvedValue([
          { sucursal_id: 'sucursal-a', activo: true, es_principal: true },
          { sucursal_id: 'sucursal-b', activo: true, es_principal: false },
        ]),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      usuarios: { findFirst: jest.fn().mockResolvedValue({ id: 'usuario-a' }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = serviceWith(prisma);

    await service.actualizarColaborador('botica-a', 'usuario-a', {
      sucursal_ids: ['sucursal-a', 'sucursal-c'],
    });

    expect(tx.usuario_sucursales.update).toHaveBeenCalledTimes(1);
    expect(tx.usuario_sucursales.update).toHaveBeenCalledWith({
      where: {
        usuario_id_sucursal_id: {
          usuario_id: 'usuario-a',
          sucursal_id: 'sucursal-b',
        },
      },
      data: { activo: false, es_principal: false },
    });
    expect(tx.usuario_sucursales.create).toHaveBeenCalledWith({
      data: {
        usuario_id: 'usuario-a',
        botica_id: 'botica-a',
        sucursal_id: 'sucursal-c',
        es_principal: false,
        activo: true,
      },
    });
  });

  it('no reescribe relaciones cuando recibe exactamente las mismas sucursales', async () => {
    const relaciones = [
      { sucursal_id: 'sucursal-a', activo: true, es_principal: true },
      { sucursal_id: 'sucursal-b', activo: true, es_principal: false },
    ];
    const tx = {
      sucursales: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'sucursal-a' }, { id: 'sucursal-b' }]),
      },
      usuarios: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'usuario-a' }),
      },
      usuario_sucursales: {
        findMany: jest.fn().mockResolvedValue(relaciones),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      usuarios: { findFirst: jest.fn().mockResolvedValue({ id: 'usuario-a' }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    await serviceWith(prisma).actualizarColaborador('botica-a', 'usuario-a', {
      sucursal_ids: ['sucursal-a', 'sucursal-b'],
    });

    expect(tx.usuario_sucursales.update).not.toHaveBeenCalled();
    expect(tx.usuario_sucursales.create).not.toHaveBeenCalled();
  });

  it('rechaza atómicamente si alguna sucursal pertenece a otra botica', async () => {
    const tx = {
      sucursales: {
        findMany: jest.fn().mockResolvedValue([{ id: 'sucursal-a' }]),
      },
      usuarios: { findFirst: jest.fn(), update: jest.fn() },
      usuario_sucursales: {
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      usuarios: { findFirst: jest.fn().mockResolvedValue({ id: 'usuario-a' }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = serviceWith(prisma);

    await expect(
      service.actualizarColaborador('botica-a', 'usuario-a', {
        sucursal_ids: ['sucursal-a', 'sucursal-ajena'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.usuarios.update).not.toHaveBeenCalled();
    expect(tx.usuario_sucursales.update).not.toHaveBeenCalled();
    expect(tx.usuario_sucursales.create).not.toHaveBeenCalled();
  });
});

describe('AdministracionGeneralService paginacion y consultas acotadas', () => {
  it('aplica defaults compatibles y rechaza lÃ­mites mayores a 100', async () => {
    const defaults = plainToInstance(PaginationQueryDto, {});
    expect(defaults).toMatchObject({ page: 1, limit: 20, buscar: '' });

    const invalid = plainToInstance(PaginationQueryDto, {
      page: '1',
      limit: '101',
    });
    const errors = await validate(invalid);
    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  const boticaRow = (index: number) => ({
    id: `botica-${index}`,
    nombre: `Botica ${index}`,
    razon_social: `Empresa ${index}`,
    ruc: `2000000000${index}`,
    direccion: null,
    telefono: null,
    email: null,
    estado: 'ACTIVO',
    created_at: new Date(),
    sucursales: [],
  });

  it.each([1, 3])(
    'mantiene cuatro agregaciones para %i botica(s), sin consultas por fila',
    async (cantidad) => {
      const rows = Array.from({ length: cantidad }, (_, index) =>
        boticaRow(index),
      );
      type FindManyArgs = {
        skip: number;
        take: number;
        where: { OR: unknown[] };
      };
      const findMany = jest
        .fn<Promise<typeof rows>, [FindManyArgs]>()
        .mockResolvedValue(rows);
      const prisma = {
        boticas: {
          count: jest.fn().mockResolvedValue(cantidad),
          findMany,
        },
        sucursales: { count: jest.fn().mockResolvedValue(0) },
        usuarios: {
          count: jest.fn().mockResolvedValue(0),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        productos_comerciales: { groupBy: jest.fn().mockResolvedValue([]) },
        ventas: { groupBy: jest.fn().mockResolvedValue([]) },
        gastos_operativos: { groupBy: jest.fn().mockResolvedValue([]) },
      };

      const result = await serviceWith(prisma).getResumen({
        page: 2,
        limit: 10,
        buscar: 'demo',
      });

      expect(prisma.usuarios.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.productos_comerciales.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.ventas.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.gastos_operativos.groupBy).toHaveBeenCalledTimes(1);
      const options = findMany.mock.calls[0][0];
      expect(options.skip).toBe(10);
      expect(options.take).toBe(10);
      expect(options.where.OR).toEqual(
        expect.arrayContaining([
          { nombre: { contains: 'demo', mode: 'insensitive' } },
          { ruc: { contains: 'demo' } },
        ]),
      );
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: cantidad,
        totalPages: 1,
      });
    },
  );

  it.each([1, 3])(
    'consulta asignaciones y ventas una vez para %i colaborador(es)',
    async (cantidad) => {
      const usuarios = Array.from({ length: cantidad }, (_, index) => ({
        id: `usuario-${index}`,
        nombre: `Persona ${index}`,
        correo: `persona${index}@demo.pe`,
        estado: 'ACTIVO',
        es_super_admin: false,
        created_at: new Date(),
        roles: { nombre: 'CAJERO' },
      }));
      const prisma = {
        boticas: { findFirst: jest.fn().mockResolvedValue({ id: 'botica-a' }) },
        usuarios: {
          count: jest.fn().mockResolvedValue(cantidad),
          findMany: jest.fn().mockResolvedValue(usuarios),
        },
        usuario_sucursales: { findMany: jest.fn().mockResolvedValue([]) },
        ventas: { groupBy: jest.fn().mockResolvedValue([]) },
      };

      const result = await serviceWith(prisma).getColaboradores('botica-a', {
        page: 1,
        limit: 2,
        buscar: 'cajero',
      });

      expect(prisma.usuario_sucursales.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.ventas.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.usuarios.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 2 }),
      );
      expect(result.data).toHaveLength(cantidad);
      expect(result.meta.total).toBe(cantidad);
    },
  );
});
