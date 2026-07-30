import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SeriesDocumentosController } from './series-documentos.controller';
import { SeriesDocumentosService } from './series-documentos.service';

@Module({
  imports: [PrismaModule],
  controllers: [SeriesDocumentosController],
  providers: [SeriesDocumentosService],
  exports: [SeriesDocumentosService]
})
export class SeriesDocumentosModule {}
