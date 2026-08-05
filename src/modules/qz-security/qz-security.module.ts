import { Module } from '@nestjs/common';
import { QzSecurityService } from './qz-security.service';

@Module({
  providers: [QzSecurityService],
  exports: [QzSecurityService],
})
export class QzSecurityModule {}
