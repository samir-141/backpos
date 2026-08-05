import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrintingQzController } from './printing-qz.controller';
import { PrintingQzService } from './printing-qz.service';

@Module({
  imports: [ConfigModule],
  controllers: [PrintingQzController],
  providers: [PrintingQzService],
  exports: [PrintingQzService],
})
export class PrintingQzModule {}
