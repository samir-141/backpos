import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProveedoresService, isValidPeruvianRuc } from './proveedores.service';

function resolvedMock<T>(value: T) {
  return jest.fn<Promise<T>, unknown[]>().mockResolvedValue(value);
}

function createPrismaMock() {
  const createCalls: unknown[] = [];
  return {
    proveedores: {
      create: jest.fn((input: unknown) => {
        createCalls.push(input);
        return Promise.resolve<unknown>(undefined);
      }),
      findFirst: resolvedMock<unknown>(null),
      findMany: resolvedMock<unknown[]>([]),
      count: resolvedMock(0),
      update: resolvedMock<unknown>(undefined),
    },
    createCalls,
  };
}

describe('ProveedoresService', () => {
  const boticaId = '11111111-1111-4111-8111-111111111111';
  const usuarioId = '22222222-2222-4222-8222-222222222222';
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: ProveedoresService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ProveedoresService(prisma as unknown as PrismaService);
  });

  it('valida el dígito verificador de un RUC peruano', () => {
    expect(isValidPeruvianRuc('20100070970')).toBe(true);
    expect(isValidPeruvianRuc('20100070971')).toBe(false);
  });

  it('crea un proveedor asociado a la botica y usuario autenticados', async () => {
    prisma.proveedores.findFirst.mockResolvedValue(null);
    await service.create(boticaId, usuarioId, {
      ruc: '20100070970',
      razon_social: 'Proveedor Demo SAC',
      email: 'VENTAS@DEMO.PE',
    });

    const createArgs = prisma.createCalls[0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).toMatchObject({
      botica_id: boticaId,
      created_by: usuarioId,
      ruc: '20100070970',
      razon_social: 'Proveedor Demo SAC',
      email: 'ventas@demo.pe',
    });
  });

  it('rechaza un RUC inválido y uno duplicado dentro del tenant', async () => {
    await expect(
      service.create(boticaId, usuarioId, {
        ruc: '20100070971',
        razon_social: 'Inválido SAC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.proveedores.findFirst.mockResolvedValue({ id: 'existente' });
    await expect(
      service.create(boticaId, usuarioId, {
        ruc: '20100070970',
        razon_social: 'Duplicado SAC',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('no recupera proveedores pertenecientes a otra botica', async () => {
    prisma.proveedores.findFirst.mockResolvedValue(null);
    await expect(
      service.findOne(boticaId, 'proveedor-ajeno'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.proveedores.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'proveedor-ajeno',
        botica_id: boticaId,
        deleted_at: null,
      },
    });
  });
});
