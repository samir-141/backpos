// src/productos/productos.module.ts
import { Module } from '@nestjs/common';
import { ProductosController } from './productos.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [ProductosController],
    providers: [PrismaService],
})
export class ProductosModule { }