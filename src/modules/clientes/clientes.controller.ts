import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@ApiTags('Clientes')
@Controller('clientes')
@UseGuards(TenantGuard, PermissionsGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @RequirePermissions('clientes.ver')
  @ApiOperation({
  })
  findAll(@Request() req: any, @Query() query: QueryClientesDto) {
    return this.clientesService.findAll(req.botica_id, query);
  }

  @Get('consultar-padron')
  @RequirePermissions('clientes.ver')
  @ApiOperation({
    summary:
      'Consultar padrón RENIEC (DNI) / SUNAT (RUC) o base de datos local',
  })
  consultarPadron(
    @Query('tipo') tipo: string,
    @Query('numero') numero: string,
  ) {
    return this.clientesService.consultarDocumentoPadron(tipo, numero);
  }

  @Get('buscar/:documento')
  @RequirePermissions('clientes.ver')
  @ApiOperation({
    summary: 'Buscar cliente por número de documento de identidad',
  })
  buscarPorDocumento(
    @Param('documento') documento: string,
    @Request() req: any,
  ) {
    return this.clientesService.buscarPorDocumento(req.botica_id, documento);
  }

  @Get(':id')
  @RequirePermissions('clientes.ver')
  @ApiOperation({
  })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.clientesService.findOne(req.botica_id, id);
  }

  @Post()
  @RequirePermissions('clientes.crear')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo cliente' })
  create(@Body() createDto: CreateClienteDto, @Request() req: any) {
    return this.clientesService.create(req.botica_id, createDto, req.user.id);
  }

  @Patch(':id')
  @RequirePermissions('clientes.editar')
  @ApiOperation({ summary: 'Actualizar información de un cliente existente' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateClienteDto,
    @Request() req: any,
  ) {
    return this.clientesService.update(
      req.botica_id,
      id,
      updateDto,
      req.user.id,
    );
  }

  @Delete(':id')
  @RequirePermissions('clientes.eliminar')
  @ApiOperation({ summary: 'Eliminar cliente (soft delete)' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.clientesService.remove(req.botica_id, id, req.user.id);
  }
}
