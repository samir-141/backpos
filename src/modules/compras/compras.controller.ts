import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
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
import { ComprasService } from './compras.service';
import { CreateCompraDto, QueryComprasDto } from './dto/compras.dto';

interface TenantRequest {
  botica_id: string;
  user: { id: string };
}

@ApiTags('Compras')
@Controller('compras')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('ADMINISTRADOR', 'GERENTE', 'ALMACENERO')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  create(
    @Request() req: TenantRequest,
    @Headers('x-sucursal-id') sucursalHeader: string | undefined,
    @Body() dto: CreateCompraDto,
  ) {
    return this.comprasService.create(
      req.botica_id,
      req.user.id,
      dto.sucursal_id || sucursalHeader,
      dto,
    );
  }

  @Get()
  findAll(
    @Request() req: TenantRequest,
    @Headers('x-sucursal-id') sucursalHeader: string | undefined,
    @Query() query: QueryComprasDto,
  ) {
    return this.comprasService.findAll(
      req.botica_id,
      req.user.id,
      query.sucursal_id || sucursalHeader,
      query,
    );
  }

  @Get(':id')
  findOne(@Request() req: TenantRequest, @Param('id') id: string) {
    return this.comprasService.findOne(req.botica_id, req.user.id, id);
  }
}
