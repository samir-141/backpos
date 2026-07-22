// src/modules/diagnosticos/diagnosticos.module.ts
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DiagnosticosController } from './diagnosticos.controller';

@Module({
    imports: [DiscoveryModule],
    controllers: [DiagnosticosController],
})
export class DiagnosticosModule { }