// src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createCorsOptions } from './common/config/cors.config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Configuración global
  app.setGlobalPrefix('api'); // Opcional: todas las rutas empiezan con /api
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.enableCors(createCorsOptions());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('FarmaPOS API')
    .setDescription('API para POS de Botica - FarmaSalud')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  // ✅ LOG SIMPLIFICADO Y ROBUSTO
  logger.log(`🚀 Servidor corriendo en: http://localhost:${port}`);
  logger.log(`📚 Swagger disponible en: http://localhost:${port}/docs`);
  logger.log(`✅ Aplicación inicializada correctamente`);
}

void bootstrap();
