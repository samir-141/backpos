import { Module, Global } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  providers: [EventsGateway, RealtimeService],
  exports: [EventsGateway, RealtimeService],
})
export class EventsModule {}
