// src/modules/productos/productos.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { QueryProductosDto } from './dto/query-productos.dto';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@ApiTags('Productos')
@Controller('productos')
export class ProductosController {
    constructor(private readonly productosService: ProductosService) { }

    @Get()
    @ApiOperation({ summary: 'Listar productos con paginación, filtros y ordenamiento' })
    findAll(@Query() query: QueryProductosDto) {
        return this.productosService.findAll(query);
    }

    @Get('sucursal/:sucursalId')
    @ApiOperation({ summary: 'Listar productos filtrados por ID de sucursal' })
    findBySucursal(@Param('sucursalId') sucursalId: string, @Query() query: QueryProductosDto) {
        return this.productosService.findAll({ ...query, sucursal_id: sucursalId });
    }

    @Get('buscar/identificador')
    @ApiOperation({ summary: 'Buscar producto comercial o presentación por SKU, código de barras o código interno' })
    buscarPorIdentificador(@Query('valor') valor: string) {
        return this.productosService.buscarPorIdentificador(valor);
    }


    @Get(':id')
    @ApiOperation({ summary: 'Obtener detalle de un producto comercial por su ID' })
    findOne(@Param('id') id: string) {
        return this.productosService.findOne(id);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Crear un nuevo producto con su medicamento y presentación inicial' })
    create(@Body() createDto: CreateProductoDto) {
        return this.productosService.create(createDto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar campos editables de un producto comercial o su presentación' })
    update(@Param('id') id: string, @Body() updateDto: UpdateProductoDto) {
        return this.productosService.update(id, updateDto);
    }

    @Post('reabastecer')
    @ApiOperation({ summary: 'Reabastecer stock de un producto agregando un lote nuevo o existente (+500 unidades)' })
    reabastecer(@Body() dto: {
        producto_comercial_id: string;
        sucursal_id?: string;
        numero_lote: string;
        fecha_vencimiento: string;
        stock_adicional: number;
        precio_compra_base: number;
    }) {
        return this.productosService.reabastecerStock(dto);
    }

    @Post(':id/presentaciones')
    @ApiOperation({ summary: 'Configurar/Actualizar presentaciones de venta unificadas por producto' })
    actualizarPresentaciones(
        @Param('id') id: string,
        @Body() dto: { presentaciones: Array<{ unidad_presentacion_id?: string; nombre?: string; cantidad_unidad_base: number; precio_actual: number; codigo_barras?: string }> }
    ) {
        return this.productosService.actualizarPresentaciones(id, dto.presentaciones);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Marcar como eliminado (soft delete) un producto comercial' })
    remove(@Param('id') id: string) {
        return this.productosService.remove(id);
    }
}