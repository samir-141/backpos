import { Module } from '@nestjs/common';
import { AdministracionGeneralController } from './administracion-general.controller';
import { AdministracionGeneralService } from './administracion-general.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdministracionGeneralController],
  providers: [AdministracionGeneralService],
})
export class AdministracionGeneralModule {}
