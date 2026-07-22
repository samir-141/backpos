// src/productos/productos.module.ts
import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
    controllers: [UsuariosController],
    providers: [PrismaService],
})
export class UsuariosModule { }