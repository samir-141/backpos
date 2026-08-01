import { Module } from '@nestjs/common';
import { AdministracionGeneralController } from './administracion-general.controller';
import { AdministracionGeneralService } from './administracion-general.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdministracionGeneralController],
  providers: [AdministracionGeneralService],
})
export class AdministracionGeneralModule {}
