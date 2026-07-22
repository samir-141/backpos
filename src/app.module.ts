import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { ProductosModule } from './modules/productos/productos.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { DiagnosticosModule } from './modules/diagnosticos/diagnosticos.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';

@Module({
  imports: [AuthModule, ProductsModule, PrismaModule, ProductosModule, UsuariosModule, DiagnosticosModule, CatalogosModule],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule { }
