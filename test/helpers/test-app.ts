import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

/** Replica la configuración HTTP relevante de main.ts sin abrir un puerto real. */
export async function initializeTestApp<T>(app: INestApplication<T>) {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

/** Evita cualquier conexión o mutación de una base de datos durante el E2E. */
export const prismaReadlessMock = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $transaction: jest.fn(() => {
    throw new Error('El E2E de rutas no debe ejecutar transacciones Prisma.');
  }),
};
