import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@ApiTags('Ventas')
@Controller('ventas')
@UseGuards(TenantGuard, PermissionsGuard)
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  @Post()
  @RequirePermissions('ventas.crear')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una nueva venta con sus detalles y pagos',
  })
  create(
    @Body() createVentaDto: CreateVentaDto,
    @Request() req: any,
    @Headers('x-sucursal-id') sucursalId?: string,
  ) {
    return this.ventasService.create(
      createVentaDto,
      req.botica_id,
      sucursalId,
      req.user.id,
    );
  }

  @Get()
  @RequirePermissions('ventas.ver')
  @ApiOperation({ summary: 'Obtener historial reciente de ventas' })
  findAll(@Request() req: any, @Headers('x-sucursal-id') sucursalId?: string) {
    return this.ventasService.findAll(req.botica_id, sucursalId);
  }

  @Get('stock-history')
  @RequirePermissions('ventas.ver')
  @ApiOperation({
    summary: 'Obtener historial de movimientos de stock de un producto',
  })
  getStockHistory(
    @Query('producto_comercial_id', new ParseUUIDPipe({ version: '4' }))
    productoComercialId: string,
    @Query('sucursal_id') sucursalId: string | undefined,
    @Request() req: any,
  ) {
    return this.ventasService.getStockHistory(
      req.botica_id,
      productoComercialId,
      sucursalId,
    );
  }

  @Get('stock-projection')
  @RequirePermissions('ventas.ver')
  @ApiOperation({ summary: 'Obtener proyección de stock para un producto' })
  getStockProjection(
    @Query('producto_comercial_id', new ParseUUIDPipe({ version: '4' }))
    productoComercialId: string,
    @Query('sucursal_id') sucursalId: string | undefined,
    @Query('dias') diasProyeccion: number | undefined,
    @Request() req: any,
  ) {
    return this.ventasService.proyeccionStock(
      req.botica_id,
      productoComercialId,
      sucursalId,
      diasProyeccion,
    );
  }

  @Get(':id')
  @RequirePermissions('ventas.ver')
  @ApiOperation({ summary: 'Obtener detalle de una venta por ID' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: any,
  ) {
    return this.ventasService.findOne(id, req.botica_id);
  }

  @Post(':id/anular')
  @UseGuards(RolesGuard)
  @RequirePermissions('ventas.anular')
  @Roles('FARMACÉUTICO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Anular una venta y reponer inventario en los lotes',
  })
  anular(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: any,
  ) {
    return this.ventasService.anular(id, req.botica_id, req.user.id);
  }
}
