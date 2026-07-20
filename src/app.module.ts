import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { ProductosModule } from './productos/productos.module';
import { ReportesModule } from './reportes/reportes.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [AuthModule, ProductsModule, PrismaModule, ProductosModule, UsuariosModule, ReportesModule],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule { }
