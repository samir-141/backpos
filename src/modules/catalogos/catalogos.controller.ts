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
  Req,
  UseGuards,
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
import {
  ICatalogoItem,
  ICatalogoListaResponse,
} from './interfaces/catalogo.interface';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@ApiTags('Catálogos Maestros')
@ApiBearerAuth()
@Controller('catalogos')
@UseGuards(TenantGuard, PermissionsGuard)
export class CatalogosController {
  private readonly logger = new Logger(CatalogosController.name);

  constructor(private readonly catalogosService: CatalogosService) {}

  @Get(':tipo')
  @RequirePermissions('catalogos.ver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar items de un catálogo' })
  @ApiParam({
    name: 'tipo',
    enum: TIPOS_CATALOGO,
    description: 'Tipo de catálogo',
  })
  @ApiResponse({ status: 200, description: 'Lista de items del catálogo' })
  async findAll(
    @Param('tipo') tipo: string,
    @Req() req: any,
    @Query() query: QueryCatalogosDto,
  ): Promise<ICatalogoListaResponse> {
    this.logger.log(`GET /catalogos/${tipo}`);
    return this.catalogosService.findAll(req.botica_id, tipo, query);
  }

  @Get(':tipo/:id')
  @RequirePermissions('catalogos.ver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener un item del catálogo por ID' })
  @ApiParam({ name: 'tipo', enum: TIPOS_CATALOGO })
  @ApiParam({ name: 'id', description: 'UUID del item' })
  @ApiResponse({ status: 200, description: 'Item del catálogo' })
  @ApiResponse({ status: 404, description: 'Item no encontrado' })
  async findOne(
    @Param('tipo') tipo: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<ICatalogoItem> {
    this.logger.log(`GET /catalogos/${tipo}/${id}`);
    return this.catalogosService.findOne(req.botica_id, tipo, id);
  }

  @Post(':tipo')
  @UseGuards(RolesGuard)
  @RequirePermissions('catalogos.gestionar')
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un nuevo item en el catálogo' })
  @ApiParam({ name: 'tipo', enum: TIPOS_CATALOGO })
  @ApiResponse({ status: 201, description: 'Item creado' })
  @ApiResponse({ status: 409, description: 'Nombre o abreviatura duplicado' })
  async create(
    @Param('tipo') tipo: string,
    @Body() dto: CreateCatalogoDto,
    @Req() req: any,
  ): Promise<ICatalogoItem> {
    const userId = req.user?.id || '11111111-0000-0000-0000-000000000001';
    this.logger.log(`POST /catalogos/${tipo} - Creando: ${dto.nombre}`);
    return this.catalogosService.create(req.botica_id, tipo, dto, userId);
  }

  @Patch(':tipo/:id')
  @UseGuards(RolesGuard)
  @RequirePermissions('catalogos.gestionar')
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar un item del catálogo' })
  @ApiParam({ name: 'tipo', enum: TIPOS_CATALOGO })
  @ApiParam({ name: 'id', description: 'UUID del item' })
  @ApiResponse({ status: 200, description: 'Item actualizado' })
  @ApiResponse({ status: 404, description: 'Item no encontrado' })
  @ApiResponse({ status: 409, description: 'Nombre o abreviatura duplicado' })
  async update(
    @Param('tipo') tipo: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogoDto,
    @Req() req: any,
  ): Promise<ICatalogoItem> {
    const userId = req.user?.id || '11111111-0000-0000-0000-000000000001';
    this.logger.log(`PATCH /catalogos/${tipo}/${id}`);
    return this.catalogosService.update(req.botica_id, tipo, id, dto, userId);
  }

  @Delete(':tipo/:id')
  @UseGuards(RolesGuard)
  @RequirePermissions('catalogos.gestionar')
  @Roles('ADMINISTRADOR', 'PROPIETARIO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar lógicamente un item del catálogo (Soft Delete)',
  })
  @ApiParam({ name: 'tipo', enum: TIPOS_CATALOGO })
  @ApiParam({ name: 'id', description: 'UUID del item' })
  @ApiResponse({ status: 200, description: 'Item eliminado lógicamente' })
  @ApiResponse({ status: 404, description: 'Item no encontrado' })
  async remove(
    @Param('tipo') tipo: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ): Promise<{ mensaje: string }> {
    const userId = req.user?.id || '11111111-0000-0000-0000-000000000001';
    this.logger.log(`DELETE /catalogos/${tipo}/${id}`);
    return this.catalogosService.remove(req.botica_id, tipo, id, userId);
  }
}
