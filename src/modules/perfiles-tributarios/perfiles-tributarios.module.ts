import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { PerfilesTributariosController } from './perfiles-tributarios.controller';
import { PerfilesTributariosService } from './perfiles-tributarios.service';

@Module({
  imports: [PrismaModule, FacturacionModule],
  controllers: [PerfilesTributariosController],
  providers: [PerfilesTributariosService],
  exports: [PerfilesTributariosService],
})
export class PerfilesTributariosModule {}
