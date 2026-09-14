import { Module } from '@nestjs/common';
import { BibliotecaProductosController } from './biblioteca-productos.controller';
import { BibliotecaProductosService } from './biblioteca-productos.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BibliotecaProductosController],
  providers: [BibliotecaProductosService],
  exports: [BibliotecaProductosService],
})
export class BibliotecaProductosModule {}
