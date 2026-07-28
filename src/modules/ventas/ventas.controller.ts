import { Controller, Get, Post, Body, Param, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';

@ApiTags('Ventas')
@Controller('ventas')
export class VentasController {
    constructor(private readonly ventasService: VentasService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Registrar una nueva venta con sus detalles y pagos' })
    create(
        @Body() createVentaDto: CreateVentaDto,
        @Headers('x-sucursal-id') sucursalId?: string
    ) {
        return this.ventasService.create(createVentaDto, sucursalId);
    }

    @Get()
    @ApiOperation({ summary: 'Obtener historial reciente de ventas' })
    findAll(@Headers('x-sucursal-id') sucursalId?: string) {
        return this.ventasService.findAll(sucursalId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener detalle de una venta por ID' })
    findOne(@Param('id') id: string) {
        return this.ventasService.findOne(id);
    }

    @Post(':id/anular')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Anular una venta y reponer inventario en los lotes' })
    anular(@Param('id') id: string) {
        return this.ventasService.anular(id);
    }
}
