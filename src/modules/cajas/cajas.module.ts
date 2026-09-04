import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CajasController } from './cajas.controller';
import { CajasService } from './cajas.service';
import { CajasAutoCierreService } from './cajas-auto-cierre.service';
import { EventsModule } from '../../socket/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [CajasController],
  providers: [CajasService, CajasAutoCierreService],
  exports: [CajasService, CajasAutoCierreService],
})
export class CajasModule {}
