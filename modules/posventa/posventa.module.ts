import { Module } from '@nestjs/common';
import { PosventaService } from './posventa.service';
import { PosventaController } from './posventa.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../../socket/events.module';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [PosventaController],
  providers: [PosventaService],
  exports: [PosventaService],
})
export class PosventaModule {}
