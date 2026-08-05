import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { GastosService } from './gastos.service';

@Controller('gastos')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class GastosController {
  constructor(private readonly gastosService: GastosService) {}

  @Get()
  listar(@Request() req: any, @Query('sucursal_id') sucursalId?: string, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.gastosService.listar(req.botica_id, sucursalId, desde, hasta);
  }

  @Post()
  crear(@Request() req: any, @Body() dto: CreateGastoDto) {
    return this.gastosService.crear(req.botica_id, dto);
  }

  @Delete(':id')
  eliminar(@Request() req: any, @Param('id') id: string) {
    return this.gastosService.eliminar(req.botica_id, id);
  }
}
