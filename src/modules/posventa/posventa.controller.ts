import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PosventaService } from './posventa.service';
import { CreateDevolucionDto } from './dto/create-devolucion.dto';
import { CreateCambioDto } from './dto/create-cambio.dto';
import { CreateGarantiaDto } from './dto/create-garantia.dto';
import { CreateReclamoDto } from './dto/create-reclamo.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';

@ApiTags('Posventa')
@Controller('posventa')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class PosventaController {
  constructor(private readonly posventaService: PosventaService) {}

  @Post('devoluciones')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar devolución de productos de una venta' })
  createDevolucion(@Body() dto: CreateDevolucionDto, @Request() req: any) {
    return this.posventaService.createDevolucion(dto, req.botica_id);
  }

  @Post('cambios')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar cambio de productos de una venta' })
  createCambio(@Body() dto: CreateCambioDto, @Request() req: any) {
    return this.posventaService.createCambio(dto, req.botica_id);
  }

  @Post('garantias')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar garantía de un producto' })
  createGarantia(@Body() dto: CreateGarantiaDto, @Request() req: any) {
    return this.posventaService.createGarantia(dto, req.botica_id);
  }

  @Post('reclamos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar reclamo de un cliente' })
  createReclamo(@Body() dto: CreateReclamoDto, @Request() req: any) {
    return this.posventaService.createReclamo(dto, req.botica_id);
  }

  @Get('venta/:ventaId')
  @ApiOperation({ summary: 'Obtener historial de posventa de una venta' })
  findByVenta(@Param('ventaId') ventaId: string, @Request() req: any) {
    return this.posventaService.findByVenta(ventaId, req.botica_id);
  }
}
