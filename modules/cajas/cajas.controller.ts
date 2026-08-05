import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CajasService } from './cajas.service';
import {
  AperturaCajaDto,
  CierreCajaDto,
  MovimientoCajaDto,
} from './dto/cajas.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';

@ApiTags('Cajas & Turnos')
@Controller('cajas')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class CajasController {
  constructor(private readonly cajasService: CajasService) {}

  @Get('estado')
  @ApiOperation({
    summary:
      'Obtener estado de la caja de la sucursal (ABIERTA/CERRADA, monto inicial, ventas acumuladas y efectivo esperado)',
  })
  getEstado(
    @Request() req: any,
    @Headers('x-sucursal-id') headerSucursalId?: string,
    @Query('sucursal_id') querySucursalId?: string,
  ) {
    const sucursalId = headerSucursalId || querySucursalId || '';
    return this.cajasService.getEstadoCaja(req.botica_id, req.user.id, sucursalId);
  }

  @Post('aperturar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aperturar turno de caja ingresando el monto inicial de sencillo',
  })
  aperturar(
    @Request() req: any,
    @Body() dto: AperturaCajaDto,
    @Headers('x-sucursal-id') sucursalIdHeader?: string,
  ) {
    const sucursalId = dto.sucursal_id || sucursalIdHeader || '';
    return this.cajasService.aperturarCaja(req.botica_id, req.user.id, sucursalId, dto);
  }

  @Post('movimiento')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar ingreso o egreso manual de efectivo en caja',
  })
  registrarMovimiento(
    @Request() req: any,
    @Body() dto: MovimientoCajaDto,
    @Headers('x-sucursal-id') sucursalIdHeader?: string,
  ) {
    const sucursalId = dto.sucursal_id || sucursalIdHeader || '';
    return this.cajasService.registrarMovimiento(req.botica_id, req.user.id, sucursalId, dto);
  }

  @Post('cerrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Realizar el arqueo y Cierre Z de la caja de turno (calcula faltante/sobrante)',
  })
  cerrar(
    @Request() req: any,
    @Body() dto: CierreCajaDto,
    @Headers('x-sucursal-id') sucursalIdHeader?: string,
  ) {
    const sucursalId = dto.sucursal_id || sucursalIdHeader || '';
    return this.cajasService.cerrarCaja(req.botica_id, req.user.id, sucursalId, dto);
  }
}
