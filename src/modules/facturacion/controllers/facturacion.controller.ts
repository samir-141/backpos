import { Controller, Post, Body } from '@nestjs/common';
import { FacturacionService } from '../services/facturacion.service';

@Controller('facturacion')
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  @Post('emitir')
  async emitirComprobante(@Body() payload: any) {
    return this.facturacionService.procesarVenta(payload);
  }
}
