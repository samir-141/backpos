import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Post,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { RequirePermissions } from '../src/auth/decorators/require-permissions.decorator';
import { PrismaService } from '../src/prisma/prisma.service';

@Controller('test-permissions')
@UseGuards(PermissionsGuard)
class TestPermissionsController {
  @Get('public-no-decorator')
  getPublicNoDecorator() {
    return { ok: true };
  }

  @Get('ventas-ver')
  @RequirePermissions('ventas.ver')
  getVentasVer() {
    return { ok: true };
  }

  @Post('ventas-crear')
  @RequirePermissions('ventas.crear')
  @HttpCode(HttpStatus.CREATED)
  postVentasCrear() {
    return { ok: true };
  }

  @Get('multi-permission')
  @RequirePermissions('reportes.ventas', 'reportes.inventario')
  getMultiPermission() {
    return { ok: true };
  }
}

function buildPrismaMock(permissions: string[]) {
  return {
    usuarios: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'user-1',
        roles: {
          rol_permisos: permissions.map((codigo) => ({
            permisos: { codigo, deleted_at: null },
          })),
        },
      }),
    },
  };
}

function softDeletedPrismaMock() {
  return {
    usuarios: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'user-1',
        roles: {
          rol_permisos: [
            {
              permisos: {
                codigo: 'ventas.ver',
                deleted_at: new Date(),
              },
            },
          ],
        },
      }),
    },
  };
}

async function createApp(
  prisma: any,
  user: any,
): Promise<INestApplication<App>> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [TestPermissionsController],
    providers: [
      Reflector,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    req.botica_id = 'botica-1';
    next();
  });
  await app.init();
  return app;
}

describe('PermissionsGuard — Integration (HTTP-level)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('Sin decorator @RequirePermissions', () => {
    it('permite acceso sin consultar la BD', async () => {
      const prisma = { usuarios: { findFirst: jest.fn() } };
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/public-no-decorator')
        .expect(200)
        .expect({ ok: true });

      expect(prisma.usuarios.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('Endpoint con 1 permiso requerido', () => {
    it('200 cuando el usuario tiene el permiso', async () => {
      const prisma = buildPrismaMock(['ventas.ver']);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/ventas-ver')
        .expect(200)
        .expect({ ok: true });
    });

    it('403 cuando el usuario no tiene el permiso', async () => {
      const prisma = buildPrismaMock([]);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/ventas-ver')
        .expect(403);
    });
  });

  describe('Endpoint POST con permiso', () => {
    it('201 cuando tiene permiso ventas.crear', async () => {
      const prisma = buildPrismaMock(['ventas.crear']);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .post('/api/test-permissions/ventas-crear')
        .expect(201)
        .expect({ ok: true });
    });

    it('403 cuando no tiene permiso ventas.crear', async () => {
      const prisma = buildPrismaMock(['ventas.ver']);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .post('/api/test-permissions/ventas-crear')
        .expect(403);
    });
  });

  describe('Múltiples permisos requeridos', () => {
    it('200 cuando tiene todos los permisos', async () => {
      const prisma = buildPrismaMock([
        'reportes.ventas',
        'reportes.inventario',
      ]);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/multi-permission')
        .expect(200)
        .expect({ ok: true });
    });

    it('403 cuando le falta 1 permiso', async () => {
      const prisma = buildPrismaMock(['reportes.ventas']);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/multi-permission')
        .expect(403);
    });

    it('403 cuando no tiene ninguno', async () => {
      const prisma = buildPrismaMock([]);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/multi-permission')
        .expect(403);
    });
  });

  describe('Bypass de admin', () => {
    it('ADMINISTRADOR pasa sin permisos en BD', async () => {
      const prisma = buildPrismaMock([]);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'ADMINISTRADOR',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/ventas-ver')
        .expect(200)
        .expect({ ok: true });
    });

    it('GERENTE pasa sin permisos en BD', async () => {
      const prisma = buildPrismaMock([]);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'GERENTE',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/ventas-ver')
        .expect(200)
        .expect({ ok: true });
    });

    it('PROPIETARIO pasa sin permisos en BD', async () => {
      const prisma = buildPrismaMock([]);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'PROPIETARIO',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/ventas-ver')
        .expect(200)
        .expect({ ok: true });
    });

    it('SUPER_ADMIN pasa sin permisos en BD', async () => {
      const prisma = buildPrismaMock([]);
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'SUPER_ADMIN',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/ventas-ver')
        .expect(200)
        .expect({ ok: true });
    });
  });

  describe('Permisos soft-deleted', () => {
    it('403 cuando el permiso tiene deleted_at', async () => {
      const prisma = softDeletedPrismaMock();
      app = await createApp(prisma, {
        id: 'user-1',
        rol: 'CAJERO',
      });

      await request(app.getHttpServer())
        .get('/api/test-permissions/ventas-ver')
        .expect(403);
    });
  });

  describe('Sin usuario autenticado', () => {
    it('403 cuando no hay user en la request', async () => {
      const prisma = buildPrismaMock(['ventas.ver']);
      app = await createApp(prisma, undefined);

      await request(app.getHttpServer())
        .get('/api/test-permissions/ventas-ver')
        .expect(403);
    });
  });
});
