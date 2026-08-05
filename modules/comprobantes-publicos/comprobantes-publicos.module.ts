import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ComprobantesPublicosController } from './comprobantes-publicos.controller';
import { ComprobantesPublicosService } from './comprobantes-publicos.service';
@Module({ imports: [PrismaModule], controllers: [ComprobantesPublicosController], providers: [ComprobantesPublicosService] })
export class ComprobantesPublicosModule {}
