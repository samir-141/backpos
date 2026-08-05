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
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
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
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('ADMINISTRADOR', 'GERENTE', 'ALMACENERO')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post()
  create(@Request() req: TenantRequest, @Body() dto: CreateProveedorDto) {
    return this.proveedoresService.create(req.botica_id, req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: TenantRequest, @Query() query: QueryProveedoresDto) {
    return this.proveedoresService.findAll(req.botica_id, query);
  }

  @Get(':id')
  findOne(@Request() req: TenantRequest, @Param('id') id: string) {
    return this.proveedoresService.findOne(req.botica_id, id);
  }

  @Patch(':id')
  update(
    @Request() req: TenantRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProveedorDto,
  ) {
    return this.proveedoresService.update(req.botica_id, req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: TenantRequest, @Param('id') id: string) {
    return this.proveedoresService.remove(req.botica_id, req.user.id, id);
  }
}
