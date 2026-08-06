import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import {
  CreateProveedorDto,
  QueryProveedoresDto,
  UpdateProveedorDto,
} from './dto/proveedor.dto';
import { ProveedoresService } from './proveedores.service';

interface TenantRequest {
  botica_id: string;
  user: { id: string };
}

@ApiTags('Proveedores')
@Controller('proveedores')
@UseGuards(TenantGuard, RolesGuard, PermissionsGuard)
@Roles('ADMINISTRADOR', 'GERENTE', 'ALMACENERO')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post()
  @RequirePermissions('proveedores.crear')
  create(@Request() req: TenantRequest, @Body() dto: CreateProveedorDto) {
    return this.proveedoresService.create(req.botica_id, req.user.id, dto);
  }

  @Get()
  @RequirePermissions('proveedores.ver')
  findAll(@Request() req: TenantRequest, @Query() query: QueryProveedoresDto) {
    return this.proveedoresService.findAll(req.botica_id, query);
  }

  @Get(':id')
  @RequirePermissions('proveedores.ver')
  findOne(@Request() req: TenantRequest, @Param('id') id: string) {
    return this.proveedoresService.findOne(req.botica_id, id);
  }

  @Patch(':id')
  @RequirePermissions('proveedores.editar')
  update(
    @Request() req: TenantRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProveedorDto,
  ) {
    return this.proveedoresService.update(req.botica_id, req.user.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('proveedores.eliminar')
  remove(@Request() req: TenantRequest, @Param('id') id: string) {
    return this.proveedoresService.remove(req.botica_id, req.user.id, id);
  }
}
