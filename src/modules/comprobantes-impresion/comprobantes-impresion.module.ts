// src/modules/comprobantes-impresion/comprobantes-impresion.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ComprobantesImpresionController } from './comprobantes-impresion.controller';
import { ComprobantesImpresionService } from './comprobantes-impresion.service';

@Module({
  imports: [PrismaModule],
  controllers: [ComprobantesImpresionController],
  providers: [ComprobantesImpresionService],
  exports: [ComprobantesImpresionService],
})
export class ComprobantesImpresionModule {}
