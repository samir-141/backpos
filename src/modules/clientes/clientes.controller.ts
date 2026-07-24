import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';

@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) { }

    @Get()
    @ApiOperation({ summary: 'Listar clientes con paginación, búsqueda y filtros' })
    findAll(@Query() query: QueryClientesDto) {
        return this.clientesService.findAll(query);
    }

    @Get('consultar-padron')
    @ApiOperation({ summary: 'Consultar padrón RENIEC (DNI) / SUNAT (RUC) o base de datos local' })
    consultarPadron(
        @Query('tipo') tipo: string,
        @Query('numero') numero: string,
    ) {
        return this.clientesService.consultarDocumentoPadron(tipo, numero);
    }

    @Get('buscar/:documento')
    @ApiOperation({ summary: 'Buscar cliente por número de documento de identidad' })
    buscarPorDocumento(@Param('documento') documento: string) {
        return this.clientesService.buscarPorDocumento(documento);
    }


    @Get(':id')
    @ApiOperation({ summary: 'Obtener detalle completo de un cliente e historial de compras' })
    findOne(@Param('id') id: string) {
        return this.clientesService.findOne(id);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Registrar un nuevo cliente' })
    create(@Body() createDto: CreateClienteDto) {
        return this.clientesService.create(createDto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar información de un cliente existente' })
    update(@Param('id') id: string, @Body() updateDto: UpdateClienteDto) {
        return this.clientesService.update(id, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar cliente (soft delete)' })
    remove(@Param('id') id: string) {
        return this.clientesService.remove(id);
    }
}
