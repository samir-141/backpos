import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';
import type { RequestAutenticada } from '../../../auth/interfaces/request-autenticada.interface';
import { ResumenDiarioService } from '../services/resumen-diario.service';
import { TenantGuard } from '../../../auth/guards/tenant.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';

class GenerarResumenDto {
  @IsDateString()
  fechaReferencia: string;
}

@ApiTags('Resúmenes Diarios SUNAT')
@Controller('facturacion/resumenes-diarios')
@UseGuards(TenantGuard, PermissionsGuard)
export class ResumenDiarioController {
  constructor(private readonly resumenes: ResumenDiarioService) {}

  @Get()
  @RequirePermissions('facturacion.resumenes')
  @ApiOperation({ summary: 'Listar resúmenes diarios de la empresa' })
  listar(@Request() req: RequestAutenticada) {
    return this.resumenes.listar(req.botica_id);
  }

  @Post('generar')
  @RequirePermissions('facturacion.resumenes')
  @Roles('ADMINISTRADOR')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generar resumen diario con las boletas pendientes de una fecha',
  })
  generar(@Body() dto: GenerarResumenDto, @Request() req: RequestAutenticada) {
    const fecha = new Date(dto.fechaReferencia);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('fechaReferencia inválida');
    }
    return this.resumenes.generar(req.botica_id, fecha, req.user.id);
  }

  @Post(':id/enviar')
  @RequirePermissions('facturacion.resumenes')
  @Roles('ADMINISTRADOR')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Firmar y enviar el resumen a SUNAT (sendSummary)' })
  enviar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestAutenticada,
  ) {
    return this.resumenes.enviar(id, req.botica_id);
  }

  @Post(':id/consultar')
  @RequirePermissions('facturacion.resumenes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar ticket del resumen en SUNAT (getStatus)',
  })
  consultar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Request() req: RequestAutenticada,
  ) {
    return this.resumenes.consultar(id, req.botica_id);
  }
}
