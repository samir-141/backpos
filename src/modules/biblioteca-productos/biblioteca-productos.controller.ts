import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BibliotecaProductosService } from './biblioteca-productos.service';
import { CreateCatalogoMaestroDto } from './dto/create-catalogo-maestro.dto';
import { QueryBibliotecaDto } from './dto/query-biblioteca.dto';
import { ResolverDependenciasDto } from './dto/asociar-local.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';

@ApiTags('Biblioteca de Productos')
@ApiBearerAuth()
@Controller('biblioteca-productos')
@UseGuards(TenantGuard)
export class BibliotecaProductosController {
  constructor(
    private readonly bibliotecaService: BibliotecaProductosService,
  ) {}

  @Get('buscar/:codigo_barras')
  @ApiOperation({
    summary: 'Buscar un producto en el catálogo maestro por código de barras',
  })
  async buscarPorCodigoBarras(@Param('codigo_barras') codigoBarras: string) {
    const producto = await this.bibliotecaService.buscarPorCodigoBarras(codigoBarras);
    if (!producto) {
      throw new NotFoundException(
        `Producto con código de barras ${codigoBarras} no encontrado en la biblioteca.`,
      );
    }
    return producto;
  }

  @Get()
  @ApiOperation({
    summary: 'Listar productos de la biblioteca global con paginación y búsqueda',
  })
  async findAll(@Query() query: QueryBibliotecaDto) {
    return this.bibliotecaService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar o contribuir un nuevo producto al catálogo maestro',
  })
  async create(@Body() dto: CreateCatalogoMaestroDto) {
    return this.bibliotecaService.create(dto);
  }

  @Post('resolver-dependencias')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Resuelve y aprovisiona automáticamente las dependencias locales en la botica (Laboratorio, Categoría, Principio Activo, etc.)',
  })
  async resolverDependencias(
    @Request() req: any,
    @Body() dto: ResolverDependenciasDto,
  ) {
    const boticaId = req.boticaId || req.user?.botica_id;
    const usuarioId = req.user?.id;
    return this.bibliotecaService.resolverDependenciasLocales(
      boticaId,
      dto.codigo_barras,
      usuarioId,
    );
  }
}
