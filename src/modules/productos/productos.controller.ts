// src/modules/productos/productos.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { QueryProductosDto } from './dto/query-productos.dto';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

const ROLES_LECTURA_PRODUCTOS = [
  'ADMINISTRADOR',
  'GERENTE',
  'FARMACÉUTICO',
  'ALMACENERO',
  'CAJERO',
  'VENDEDOR',
];
const ROLES_GESTION_INVENTARIO = [
  'ADMINISTRADOR',
  'GERENTE',
  'FARMACÉUTICO',
  'ALMACENERO',
];

@ApiTags('Productos')
@Controller('productos')
@UseGuards(TenantGuard, RolesGuard, PermissionsGuard)
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  @Roles(...ROLES_LECTURA_PRODUCTOS)
  @RequirePermissions('inventario.ver')
  @ApiOperation({
    summary: 'Listar productos con paginación, filtros y ordenamiento',
  })
  findAll(
    @Request() req: any,
    @Query() query: QueryProductosDto,
    @Headers('x-sucursal-id') sucursalHeader?: string,
  ) {
    const sucursalId = query.sucursal_id || sucursalHeader;
    return this.productosService.findAll(
      req.botica_id,
      {
        ...query,
        sucursal_id: sucursalId,
      },
      req.user.id,
    );
  }

  @Get('sucursal/:sucursalId')
  @Roles(...ROLES_LECTURA_PRODUCTOS)
  @RequirePermissions('inventario.ver')
  @ApiOperation({ summary: 'Listar productos filtrados por ID de sucursal' })
  findBySucursal(
    @Request() req: any,
    @Param('sucursalId') sucursalId: string,
    @Query() query: QueryProductosDto,
  ) {
    return this.productosService.findAll(
      req.botica_id,
      {
        ...query,
        sucursal_id: sucursalId,
      },
      req.user.id,
    );
  }

  @Get('buscar/identificador')
  @Roles(...ROLES_LECTURA_PRODUCTOS)
  @RequirePermissions('inventario.ver')
  @ApiOperation({
    summary:
      'Buscar producto comercial o presentación por SKU, código de barras o código interno',
  })
  buscarPorIdentificador(@Query('valor') valor: string, @Request() req: any) {
    return this.productosService.buscarPorIdentificador(req.botica_id, valor);
  }

  @Get(':id')
  @Roles(...ROLES_LECTURA_PRODUCTOS)
  @RequirePermissions('inventario.ver')
  @ApiOperation({
    summary: 'Obtener detalle de un producto comercial por su ID',
  })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.productosService.findOne(req.botica_id, id);
  }

  @Post()
  @Roles(...ROLES_GESTION_INVENTARIO)
  @RequirePermissions('inventario.crear')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Crear un nuevo producto con su medicamento y presentación inicial',
  })
  create(@Body() createDto: CreateProductoDto, @Request() req: any) {
    return this.productosService.create(req.botica_id, createDto, req.user.id);
  }

  @Patch(':id')
  @Roles(...ROLES_GESTION_INVENTARIO)
  @RequirePermissions('inventario.editar')
  @ApiOperation({
    summary:
      'Actualizar campos editables de un producto comercial o su presentación',
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductoDto,
    @Request() req: any,
  ) {
    return this.productosService.update(req.botica_id, id, updateDto);
  }

  @Post('reabastecer')
  @Roles(...ROLES_GESTION_INVENTARIO)
  @RequirePermissions('inventario.reabastecer')
  @ApiOperation({
    summary:
      'Reabastecer stock de un producto agregando un lote nuevo o existente (+500 unidades)',
  })
  reabastecer(
    @Request() req: any,
    @Body()
    dto: {
      producto_comercial_id: string;
      sucursal_id?: string;
      numero_lote: string;
      fecha_vencimiento?: string;
      stock_adicional: number;
      precio_compra_base: number;
    },
  ) {
    return this.productosService.reabastecerStock(
      req.botica_id,
      dto,
      req.user.id,
    );
  }

  @Post(':id/presentaciones')
  @Roles(...ROLES_GESTION_INVENTARIO)
  @RequirePermissions('inventario.presentaciones')
  @ApiOperation({
    summary:
      'Configurar/Actualizar presentaciones de venta unificadas por producto',
  })
  actualizarPresentaciones(
    @Param('id') id: string,
    @Request() req: any,
    @Body()
    dto: {
      presentaciones: Array<{
        unidad_presentacion_id?: string;
        nombre?: string;
        cantidad_unidad_base: number;
        precio_actual: number;
        codigo_barras?: string;
      }>;
    },
  ) {
    return this.productosService.actualizarPresentaciones(
      req.botica_id,
      id,
      dto.presentaciones,
    );
  }

  @Delete(':id')
  @Roles(...ROLES_GESTION_INVENTARIO)
  @RequirePermissions('inventario.eliminar')
  @ApiOperation({
    summary: 'Marcar como eliminado (soft delete) un producto comercial',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.productosService.remove(req.botica_id, id);
  }
}
