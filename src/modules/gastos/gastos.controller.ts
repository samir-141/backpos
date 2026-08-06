import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { GastosService } from './gastos.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GastosAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    const rol = String(user?.rol || '')
      .trim()
      .toUpperCase();
    if (user?.es_super_admin || rol === 'ADMINISTRADOR') return true;
    throw new ForbiddenException(
      'Solo el administrador puede gestionar gastos.',
    );
  }
}

@Controller('gastos')
@UseGuards(TenantGuard, GastosAdminGuard, PermissionsGuard)
export class GastosController {
  constructor(
    private readonly gastosService: GastosService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions('gastos.ver')
  async listar(
    @Request() req: any,
    @Query('sucursal_id') sucursalId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const target = sucursalId || req.user.sucursal_id;
    await this.assertSucursalAsignada(req, target);
    return this.gastosService.listar(req.botica_id, target, desde, hasta);
  }

  @Post()
  @RequirePermissions('gastos.crear')
  async crear(@Request() req: any, @Body() dto: CreateGastoDto) {
    const target = dto.sucursal_id || req.user.sucursal_id;
    await this.assertSucursalAsignada(req, target);
    return this.gastosService.crear(req.botica_id, {
      ...dto,
      sucursal_id: target,
    });
  }

  @Delete(':id')
  @RequirePermissions('gastos.eliminar')
  async eliminar(@Request() req: any, @Param('id') id: string) {
    const gasto = await this.prisma.gastos_operativos.findFirst({
      where: { id, botica_id: req.botica_id, deleted_at: null },
      select: { sucursal_id: true },
    });
    if (!gasto) throw new BadRequestException('Gasto no encontrado.');
    await this.assertSucursalAsignada(
      req,
      gasto.sucursal_id || req.user.sucursal_id,
    );
    return this.gastosService.eliminar(req.botica_id, id);
  }

  private async assertSucursalAsignada(req: any, sucursalId?: string) {
    if (!sucursalId) {
      throw new BadRequestException(
        'Debe indicar una sucursal asignada al usuario.',
      );
    }
    const asignacion = await this.prisma.usuario_sucursales.findFirst({
      where: {
        usuario_id: req.user.id,
        botica_id: req.botica_id,
        sucursal_id: sucursalId,
        activo: true,
        sucursales: { deleted_at: null, botica_id: req.botica_id },
      },
      select: { sucursal_id: true },
    });
    if (!asignacion) {
      throw new ForbiddenException(
        'La sucursal no está asignada al usuario autenticado.',
      );
    }
  }
}
