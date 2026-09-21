import { Module } from '@nestjs/common';
import { BibliotecaProductosController } from './biblioteca-productos.controller';
import { BibliotecaProductosService } from './biblioteca-productos.service';
import { ScraperProductosService } from './services/scraper-productos.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BibliotecaProductosController],
  providers: [BibliotecaProductosService, ScraperProductosService],
  exports: [BibliotecaProductosService, ScraperProductosService],
})
export class BibliotecaProductosModule {}
