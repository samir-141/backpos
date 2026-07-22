// src/modules/productos/productos.module.ts
import { Module } from '@nestjs/common';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { PrismaModule } from '../../prisma/prisma.module'; // Ajusta la ruta

@Module({
    imports: [PrismaModule],
    controllers: [ProductosController],
    providers: [ProductosService],
    exports: [ProductosService],
})
export class ProductosModule { }