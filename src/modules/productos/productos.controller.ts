// src/modules/productos/productos.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductosService } from './productos.service';

@ApiTags('Productos')
@Controller('productos') // ✅ ESTO ES CLAVE - define la ruta base
export class ProductosController {
    constructor(private readonly productosService: ProductosService) { }

    @Get()
    findAll() {
        return this.productosService.findAll({});
    }
}