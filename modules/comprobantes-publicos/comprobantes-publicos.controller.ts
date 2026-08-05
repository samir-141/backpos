import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { ComprobantesPublicosService } from './comprobantes-publicos.service';

@Controller('comprobantes-publicos')
export class ComprobantesPublicosController {
  constructor(private readonly service: ComprobantesPublicosService) {}
  @Get('venta/:ventaId')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  obtenerPorVenta(@Param('ventaId') ventaId: string, @Request() req: any) {
    return this.service.obtenerPorVenta(ventaId, req.botica_id);
  }

  @Get(':token') obtener(@Param('token') token: string) { return this.service.obtener(token); }
}
