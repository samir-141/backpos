// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get()
  getHealth(): string {
    return '🚀 FarmaPOS API is running!';
  }
}