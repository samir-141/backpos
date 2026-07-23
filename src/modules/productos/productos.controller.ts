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

    @Delete(':id')
    @ApiOperation({ summary: 'Marcar como eliminado (soft delete) un producto comercial' })
    remove(@Param('id') id: string) {
        return this.productosService.remove(id);
    }
}