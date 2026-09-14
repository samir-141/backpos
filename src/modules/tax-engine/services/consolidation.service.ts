import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConsolidateDailySalesDto } from '../dto/consolidate-daily-sales.dto';
import { TaxEngineService } from './tax-engine.service';

@Injectable()
export class ConsolidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxEngine: TaxEngineService,
  ) {}

  async getPendingSubFiveSales(
    boticaId: string,
    cajaId: string,
    fecha?: string,
  ) {
    const targetDate = fecha ? new Date(fecha) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Ventas menores a S/ 5 sin comprobante electrónico emitido
    const ventasMenores = await this.prisma.ventas.findMany({
      where: {
        botica_id: boticaId,
        caja_id: cajaId,
        total: { lt: 5.0 },
        comprobantes_electronicos: {
          none: {},
        },
        fecha: {
          gte: startOfDay,
          lte: endOfDay,
        },
        deleted_at: null,
      },
      select: {
        id: true,
        total: true,
        fecha: true,
        created_at: true,
      },
    });

    const totalAcumulado = ventasMenores.reduce(
      (sum, v) => sum + Number(v.total || 0),
      0,
    );

    return {
      cajaId,
      fecha: targetDate.toISOString().split('T')[0],
      cantidadOperaciones: ventasMenores.length,
      totalAcumulado: Number(totalAcumulado.toFixed(2)),
      ventas: ventasMenores,
    };
  }

  async consolidateDailySales(
    boticaId: string,
    dto: ConsolidateDailySalesDto,
    usuarioId: string,
  ) {
    const pendings = await this.getPendingSubFiveSales(
      boticaId,
      dto.cajaId,
      dto.fecha,
    );

    if (pendings.cantidadOperaciones === 0) {
      throw new BadRequestException(
        'No existen operaciones menores a S/ 5.00 pendientes de consolidación para este turno/fecha.',
      );
    }

    const perfil = await this.taxEngine.getActiveTaxProfile(
      boticaId,
      dto.perfilTributarioId,
    );

    if (!perfil) {
      throw new BadRequestException(
        'No se puede emitir la boleta consolidada sin un perfil tributario configurado.',
      );
    }

    return {
      mensaje: 'Consolidación de ventas menores registrada exitosamente.',
      boticaId,
      cajaId: dto.cajaId,
      perfilTributarioId: perfil.id,
      ruc: perfil.ruc,
      fecha: pendings.fecha,
      cantidadOperaciones: pendings.cantidadOperaciones,
      totalConsolidado: pendings.totalAcumulado,
      tipoDocumento: perfil.regimen_tributario === 'NRUS' ? '12' : '03',
      denominacion: 'VENTAS MENORES DEL DÍA - CONSOLIDADO',
      generadoPor: usuarioId,
    };
  }
}
