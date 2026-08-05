// src/modules/diagnosticos/diagnosticos.module.ts
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DiagnosticosController } from './diagnosticos.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [DiscoveryModule, AuthModule],
  controllers: [DiagnosticosController],
})
export class DiagnosticosModule {}
