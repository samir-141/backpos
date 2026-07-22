// src/modules/catalogos/catalogos.controller.ts
import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { CatalogosService } from './catalogos.service';
import { CreateCatalogoDto } from './dto/create-catalogo.dto';
import { UpdateCatalogoDto } from './dto/update-catalogo.dto';
import { QueryCatalogosDto } from './dto/query-catalogos.dto';
import { TIPOS_CATALOGO } from './constants/catalogos.constants';
import { ICatalogoItem, ICatalogoListaResponse } from './interfaces/catalogo.interface';

@ApiTags('Catálogos Maestros')
@ApiBearerAuth()
@Controller('catalogos')
export class CatalogosController {
    private readonly logger = new Logger(CatalogosController.name);

    constructor(private readonly catalogosService: CatalogosService) { }

    @Get(':tipo')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Listar items de un catálogo' })
    @ApiParam({
        name: 'tipo',
        enum: TIPOS_CATALOGO,
        description: 'Tipo de catálogo',
    })
    @ApiResponse({ status: 200, type: Object })
    async findAll(
        @Param('tipo') tipo: string,
        @Query() query: QueryCatalogosDto,
    ): Promise<ICatalogoListaResponse> {
        this.logger.log(`GET /catalogos/${tipo}`);
        return this.catalogosService.findAll(tipo, query);
    }

    @Get(':tipo/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Obtener un item del catálogo por ID' })
    @ApiParam({ name: 'tipo', enum: TIPOS_CATALOGO })
    @ApiParam({ name: 'id', description: 'UUID del item' })
    @ApiResponse({ status: 200, type: Object })
    @ApiResponse({ status: 404, description: 'Item no encontrado' })
    async findOne(
        @Param('tipo') tipo: string,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<ICatalogoItem> {
        this.logger.log(`GET /catalogos/${tipo}/${id}`);
        return this.catalogosService.findOne(tipo, id);
    }

    @Post(':tipo')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Crear un nuevo item en el catálogo' })
    @ApiParam({ name: 'tipo', enum: TIPOS_CATALOGO })
    @ApiResponse({ status: 201, description: 'Item creado', type: Object })
    @ApiResponse({ status: 409, description: 'Nombre o abreviatura duplicado' })
    async create(
        @Param('tipo') tipo: string,
        @Body() dto: CreateCatalogoDto,
    ): Promise<ICatalogoItem> {
        // TODO: Reemplazar con @User() cuando tengas el decorador listo
        const userId = '11111111-0000-0000-0000-000000000001';
        this.logger.log(`POST /catalogos/${tipo} - Creando: ${dto.nombre}`);
        return this.catalogosService.create(tipo, dto, userId);
    }

    @Patch(':tipo/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Actualizar un item del catálogo' })
    @ApiParam({ name: 'tipo', enum: TIPOS_CATALOGO })
    @ApiParam({ name: 'id', description: 'UUID del item' })
    @ApiResponse({ status: 200, description: 'Item actualizado', type: Object })
    @ApiResponse({ status: 404, description: 'Item no encontrado' })
    @ApiResponse({ status: 409, description: 'Nombre o abreviatura duplicado' })
    async update(
        @Param('tipo') tipo: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCatalogoDto,
    ): Promise<ICatalogoItem> {
        // TODO: Reemplazar con @User()
        const userId = '11111111-0000-0000-0000-000000000001';
        this.logger.log(`PATCH /catalogos/${tipo}/${id}`);
        return this.catalogosService.update(tipo, id, dto, userId);
    }

    @Delete(':tipo/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Eliminar lógicamente un item del catálogo (Soft Delete)' })
    @ApiParam({ name: 'tipo', enum: TIPOS_CATALOGO })
    @ApiParam({ name: 'id', description: 'UUID del item' })
    @ApiResponse({ status: 200, description: 'Item eliminado lógicamente' })
    @ApiResponse({ status: 404, description: 'Item no encontrado' })
    async remove(
        @Param('tipo') tipo: string,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<{ mensaje: string }> {
        // TODO: Reemplazar con @User()
        const userId = '11111111-0000-0000-0000-000000000001';
        this.logger.log(`DELETE /catalogos/${tipo}/${id}`);
        return this.catalogosService.remove(tipo, id, userId);
    }
}