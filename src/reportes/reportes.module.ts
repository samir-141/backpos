// src/reportes/reportes.module.ts
import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { PrismaService } from '../prisma/prisma.service'; // Ajusta la ruta

@Module({
    controllers: [ReportesController],
    providers: [PrismaService],
})
export class ReportesModule { }