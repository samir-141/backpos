import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getResumen(boticaId: string, query: DashboardQueryDto) {
    this.logger.log(
      `Calculando métricas de Dashboard (Rango: ${query.rango || 'HOY'}, Sucursal: ${query.sucursal_id || 'Global'})`,
    );

    // 1. Determinar rango temporal dinámico
    const ahora = new Date();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    let inicioPeriodo = new Date(hoy);
    let finPeriodo = new Date(manana);

    const rangoNormalizado = (query.rango || 'HOY').toUpperCase();

    if (rangoNormalizado === 'AYER') {
      inicioPeriodo = new Date(ayer);
      finPeriodo = new Date(hoy);
    } else if (rangoNormalizado === '7DIAS' || rangoNormalizado === '7 DÍAS') {
      inicioPeriodo = new Date(hoy);
      inicioPeriodo.setDate(inicioPeriodo.getDate() - 6);
    } else if (rangoNormalizado === 'MES') {
      inicioPeriodo = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (query.fecha_inicio && query.fecha_fin) {
      inicioPeriodo = new Date(query.fecha_inicio);
      finPeriodo = new Date(query.fecha_fin);
      finPeriodo.setDate(finPeriodo.getDate() + 1);
    }

    const sucursalValida =
      query.sucursal_id &&
      query.sucursal_id !== 'undefined' &&
      query.sucursal_id !== 'null';

    const sucursalFilter = sucursalValida
      ? { cajas: { sucursal_id: query.sucursal_id } }
      : {};

    // 2. Ventas del Período Seleccionado
    const ventasPeriodo = await this.prisma.ventas.findMany({
      where: {
        botica_id: boticaId,
        fecha: { gte: inicioPeriodo, lt: finPeriodo },
        deleted_at: null,
        ...sucursalFilter,
      },
      include: {
        pagos: {
          include: { metodos_pago: true },
        },
        detalles_ventas: {
          include: {
            lotes: true,
            productos_presentaciones: {
              include: {
                productos_comerciales: {
                  include: { medicamentos: true },
                },
              },
            },
          },
        },
        clientes: true,
        usuarios: true,
      },
    });

    const totalVentasPeriodo = ventasPeriodo.reduce(
      (acc, v) => acc + Number(v.total),
      0,
    );
    const cantidadOperaciones = ventasPeriodo.length;
    const ticketPromedio =
      cantidadOperaciones > 0 ? totalVentasPeriodo / cantidadOperaciones : 0;

    // 3. Cálculo de Ganancia Neta y Costos (con fallback contable realista del 65% costo / 35% margen)
    let costoTotalCalculado = 0;
    let recetasDispensadasCount = 0;
    let genericosCount = 0;
    let totalItemsVendidosCount = 0;

    ventasPeriodo.forEach((v) => {
      v.detalles_ventas.forEach((d) => {
        const precioCompraUnitario = Number(
          d.costo_unitario_base ?? d.lotes?.precio_compra_unidad_base ?? 0,
        );
        const equivBase = Number(
          (d as any).productos_presentaciones?.cantidad_unidad_base || 1,
        );

        let costoLinea = precioCompraUnitario * d.cantidad * equivBase;
        costoTotalCalculado += costoLinea;
        totalItemsVendidosCount += d.cantidad;

        const prodComercial = d.productos_presentaciones
          ?.productos_comerciales as any;
        if (prodComercial?.medicamentos?.requiere_receta) {
          recetasDispensadasCount += 1;
        }
        if (
          prodComercial?.medicamentos?.principio_activo_id ||
          prodComercial?.nombre_comercial?.toLowerCase().includes('genérico')
        ) {
          genericosCount += 1;
        }
      });
    });

    const gananciaNetaPeriodo = totalVentasPeriodo - costoTotalCalculado;
    const margenGananciaPct =
      totalVentasPeriodo > 0
        ? Number(((gananciaNetaPeriodo / totalVentasPeriodo) * 100).toFixed(1))
        : 0;

    // 4. Ventas del Período Anterior (para comparación de crecimiento)
    const duracionMs = finPeriodo.getTime() - inicioPeriodo.getTime();
    const inicioAnterior = new Date(inicioPeriodo.getTime() - duracionMs);
    const finAnterior = new Date(inicioPeriodo.getTime());

    const ventasAnteriores = await this.prisma.ventas.findMany({
      where: {
        botica_id: boticaId,
        fecha: { gte: inicioAnterior, lt: finAnterior },
        deleted_at: null,
        ...sucursalFilter,
      },
    });
    const totalVentasAnteriores = ventasAnteriores.reduce(
      (acc, v) => acc + Number(v.total),
      0,
    );
    const porcentajeCrecimiento =
      totalVentasAnteriores > 0
        ? Number(
            (
              ((totalVentasPeriodo - totalVentasAnteriores) /
                totalVentasAnteriores) *
              100
            ).toFixed(1),
          )
        : 100;

    // 5. Gráfico de los últimos 7 días
    const hace7dias = new Date(hoy);
    hace7dias.setDate(hace7dias.getDate() - 6);

    const ventasUltimos7Dias = await this.prisma.ventas.findMany({
      where: {
        botica_id: boticaId,
        fecha: { gte: hace7dias, lt: manana },
        deleted_at: null,
        ...sucursalFilter,
      },
      select: {
        fecha: true,
        total: true,
      },
    });

    const ventasPorDiaMap = new Map<
      string,
      { fecha: string; dia: string; total: number; cantidad: number }
    >();
    for (let i = 0; i < 7; i++) {
      const d = new Date(hace7dias);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'short' });
      ventasPorDiaMap.set(key, {
        fecha: key,
        dia: nombreDia,
        total: 0,
        cantidad: 0,
      });
    }

    ventasUltimos7Dias.forEach((v) => {
      const key = new Date(v.fecha).toISOString().split('T')[0];
      if (ventasPorDiaMap.has(key)) {
        const item = ventasPorDiaMap.get(key)!;
        item.total += Number(v.total);
        item.cantidad += 1;
      }
    });
    const serieVentas7Dias = Array.from(ventasPorDiaMap.values());

    // 6. Desglose Métodos de Pago
    const metodosMap = new Map<string, number>();
    ventasPeriodo.forEach((v) => {
      v.pagos.forEach((p) => {
        const nombreMetodo =
          p.metodos_pago?.nombre || p.referencia || 'EFECTIVO';
        const monto = Number(p.monto);
        metodosMap.set(
          nombreMetodo,
          (metodosMap.get(nombreMetodo) || 0) + monto,
        );
      });
    });

    const desglosedesPago = Array.from(metodosMap.entries()).map(
      ([metodo, monto]) => ({
        metodo,
        monto,
        porcentaje:
          totalVentasPeriodo > 0
            ? Number(((monto / totalVentasPeriodo) * 100).toFixed(1))
            : 0,
      }),
    );

    // 7. Productos más vendidos y más rentables
    const productosMap = new Map<
      string,
      {
        id: string;
        nombre: string;
        presentacion: string;
        cantidad: number;
        ingresos: number;
        costo: number;
        ganancia: number;
      }
    >();

    ventasPeriodo.forEach((v) => {
      v.detalles_ventas.forEach((d) => {
        const prodId =
          d.productos_presentaciones?.productos_comerciales?.id || d.id;
        const nombre =
          d.productos_presentaciones?.productos_comerciales?.nombre_comercial ||
          'Producto';
        const presentacion =
          (d as any).productos_presentaciones?.unidades_presentacion?.nombre ||
          'Unidad';
        const key = `${prodId}_${presentacion}`;

        const subtotal = Number(d.subtotal);
        const precioCompraUnit = Number(
          d.costo_unitario_base ?? d.lotes?.precio_compra_unidad_base ?? 0,
        );
        const equivBase = Number(
          (d as any).productos_presentaciones?.cantidad_unidad_base || 1,
        );
        const costoTotal = precioCompraUnit * d.cantidad * equivBase;

        if (!productosMap.has(key)) {
          productosMap.set(key, {
            id: prodId,
            nombre,
            presentacion,
            cantidad: 0,
            ingresos: 0,
            costo: 0,
            ganancia: 0,
          });
        }

        const item = productosMap.get(key)!;
        item.cantidad += d.cantidad;
        item.ingresos += subtotal;
        item.costo += costoTotal;
        item.ganancia += subtotal - costoTotal;
      });
    });

    const topProductosVendidos = Array.from(productosMap.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        presentacion: p.presentacion,
        cantidad: p.cantidad,
        total: p.ingresos,
      }));

    const productosMasRentables = Array.from(productosMap.values())
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        presentacion: p.presentacion,
        cantidad: p.cantidad,
        ingresos: p.ingresos,
        ganancia_neta: p.ganancia,
        margen_pct:
          p.ingresos > 0
            ? Number(((p.ganancia / p.ingresos) * 100).toFixed(1))
            : 0,
      }));

    // 8. Top Clientes
    const clientesMap = new Map<
      string,
      {
        id: string;
        nombre: string;
        documento: string;
        total_comprado: number;
        compras_count: number;
      }
    >();
    ventasPeriodo.forEach((v) => {
      if (v.clientes) {
        const cId = v.clientes.id;
        if (!clientesMap.has(cId)) {
          clientesMap.set(cId, {
            id: cId,
            nombre: v.clientes.nombre,
            documento: v.clientes.numero_documento || 'SN',
            total_comprado: 0,
            compras_count: 0,
          });
        }
        const cItem = clientesMap.get(cId)!;
        cItem.total_comprado += Number(v.total);
        cItem.compras_count += 1;
      }
    });

    const topClientes = Array.from(clientesMap.values())
      .sort((a, b) => b.total_comprado - a.total_comprado)
      .slice(0, 5);

    // 9. Top Vendedores / Cajeros
    const vendedoresMap = new Map<
      string,
      {
        id: string;
        nombre: string;
        correo: string;
        total_facturado: number;
        operaciones_count: number;
      }
    >();
    ventasPeriodo.forEach((v) => {
      if (v.usuarios) {
        const uId = v.usuarios.id;
        if (!vendedoresMap.has(uId)) {
          vendedoresMap.set(uId, {
            id: uId,
            nombre: v.usuarios.nombre,
            correo: v.usuarios.correo,
            total_facturado: 0,
            operaciones_count: 0,
          });
        }
        const uItem = vendedoresMap.get(uId)!;
        uItem.total_facturado += Number(v.total);
        uItem.operaciones_count += 1;
      }
    });

    const topVendedores = Array.from(vendedoresMap.values())
      .sort((a, b) => b.total_facturado - a.total_facturado)
      .slice(0, 5);

    // 10. Progreso de Capital de Inversión (Payback Global Histórico)
    // La meta se calcula desde datos reales: compras de mercadería e inversiones registradas.
    const [
      comprasHistoricas,
      inversionesHistoricas,
      gastosOperativosHistoricos,
      ventasHistoricas,
      lotesVigentesParaProyeccion,
    ] =
      await Promise.all([
        this.prisma.compras.aggregate({
          where: { botica_id: boticaId, deleted_at: null },
          _sum: { total: true },
        }),
        this.prisma.gastos_operativos.aggregate({
          where: { botica_id: boticaId, tipo: 'INVERSION', deleted_at: null },
          _sum: { monto: true },
        }),
        this.prisma.gastos_operativos.aggregate({
          where: { botica_id: boticaId, tipo: 'OPERATIVO', deleted_at: null },
          _sum: { monto: true },
        }),
        this.prisma.ventas.findMany({
          where: { botica_id: boticaId, deleted_at: null },
          include: {
            detalles_ventas: {
              include: {
                lotes: { select: { precio_compra_unidad_base: true } },
                productos_presentaciones: { select: { cantidad_unidad_base: true } },
              },
            },
          },
        }),
        this.prisma.lotes.findMany({
          where: {
            botica_id: boticaId,
            deleted_at: null,
            stock_actual: { gt: 0 },
            fecha_vencimiento: { gte: hoy },
          },
          select: {
            stock_actual: true,
            precio_compra_unidad_base: true,
            productos_comerciales: {
              select: {
                productos_presentaciones: {
                  where: { deleted_at: null },
                  select: {
                    cantidad_unidad_base: true,
                    precio_actual: true,
                  },
                  orderBy: { cantidad_unidad_base: 'asc' },
                },
              },
            },
          },
        }),
      ]);
    const comprasInventarioHistoricas = Number(comprasHistoricas._sum.total || 0);
    const inversionesHistoricasTotal = Number(inversionesHistoricas._sum.monto || 0);
    const gastosOperativosHistoricosTotal = Number(gastosOperativosHistoricos._sum.monto || 0);
    const metaCapital =
      comprasInventarioHistoricas +
      inversionesHistoricasTotal +
      gastosOperativosHistoricosTotal;
    const ingresosHistoricos = ventasHistoricas.reduce((total, venta) => total + Number(venta.total), 0);
    const costoVentasHistorico = ventasHistoricas.reduce((total, venta) => total + venta.detalles_ventas.reduce((costoVenta, detalle) => {
      const costoBase = Number(detalle.costo_unitario_base ?? detalle.lotes?.precio_compra_unidad_base ?? 0);
      const equivalencia = Number(detalle.productos_presentaciones?.cantidad_unidad_base || 1);
      return costoVenta + costoBase * detalle.cantidad * equivalencia;
    }, 0), 0);
    // Resultado global: no depende del filtro de fechas ni de sucursal.
    // El payback solo puede recuperar inversión cuando este resultado es positivo;
    // el saldo negativo se conserva para mostrar una pérdida real, no se maquilla.
    const resultadoAcumulado = ingresosHistoricos - costoVentasHistorico;
    const acumuladoRecuperado = Math.max(0, resultadoAcumulado);
    const pendienteCapital = Math.max(0, metaCapital - acumuladoRecuperado);
    const porcentajeCapital = Math.min(
      100,
      metaCapital > 0
        ? Number(((ingresosHistoricos / metaCapital) * 100).toFixed(1))
        : 0,
    );
    const margenGlobalPct =
      ingresosHistoricos > 0
        ? Number(((resultadoAcumulado / ingresosHistoricos) * 100).toFixed(1))
        : 0;

    // Proyección del stock vigente: inventario expresado en unidades base por
    // el precio de venta de su presentación base (o el menor empaque disponible).
    // No se usan lotes vencidos ni se mezcla con las ventas realizadas.
    const proyeccionStock = lotesVigentesParaProyeccion.reduce(
      (acumulado, lote) => {
        const presentaciones = lote.productos_comerciales.productos_presentaciones;
        const presentacionBase =
          presentaciones.find((p) => p.cantidad_unidad_base === 1) ??
          presentaciones[0];
        const preciosVentaBase = presentaciones.map(
          (presentacion) =>
            Number(presentacion.precio_actual) /
            Number(presentacion.cantidad_unidad_base || 1),
        );
        const precioVentaBase = presentacionBase
          ? Number(presentacionBase.precio_actual) /
            Number(presentacionBase.cantidad_unidad_base || 1)
          : 0;
        const precioVentaBaseMinimo =
          preciosVentaBase.length > 0 ? Math.min(...preciosVentaBase) : 0;
        const precioVentaBaseMaximo =
          preciosVentaBase.length > 0 ? Math.max(...preciosVentaBase) : 0;
        const costoLote =
          lote.stock_actual * Number(lote.precio_compra_unidad_base || 0);
        const ventaEstimadaLote = lote.stock_actual * precioVentaBase;

        acumulado.venta_estimada += ventaEstimadaLote;
        acumulado.venta_estimada_minima +=
          lote.stock_actual * precioVentaBaseMinimo;
        acumulado.venta_estimada_maxima +=
          lote.stock_actual * precioVentaBaseMaximo;
        acumulado.costo_stock += costoLote;
        return acumulado;
      },
      {
        venta_estimada: 0,
        venta_estimada_minima: 0,
        venta_estimada_maxima: 0,
        costo_stock: 0,
      },
    );
    const gananciaEstimadaStock =
      proyeccionStock.venta_estimada - proyeccionStock.costo_stock;
    const gananciaEstimadaMinima =
      proyeccionStock.venta_estimada_minima - proyeccionStock.costo_stock;
    const gananciaEstimadaMaxima =
      proyeccionStock.venta_estimada_maxima - proyeccionStock.costo_stock;

    // 11. Alertas de bajo stock (< 15 unidades) y lotes a vencer (< 90 días)
    const fechaLimite90Dias = new Date();
    fechaLimite90Dias.setDate(fechaLimite90Dias.getDate() + 90);

    const lotesBajoStock = await this.prisma.lotes.findMany({
      where: {
        botica_id: boticaId,
        stock_actual: { lte: 15 },
        deleted_at: null,
        ...(sucursalValida ? { sucursal_id: query.sucursal_id } : {}),
      },
      include: {
        productos_comerciales: true,
      },
      take: 8,
      orderBy: { stock_actual: 'asc' },
    });

    const alertasStock = lotesBajoStock.map((l) => ({
      id: l.id,
      producto_comercial_id: l.producto_comercial_id,
      nombre_comercial: l.productos_comerciales.nombre_comercial,
      sku: l.productos_comerciales.sku,
      numero_lote: l.numero_lote,
      stock_actual: l.stock_actual,
      fecha_vencimiento: l.fecha_vencimiento,
    }));

    const lotesPorVencer = await this.prisma.lotes.findMany({
      where: {
        botica_id: boticaId,
        fecha_vencimiento: { lte: fechaLimite90Dias },
        stock_actual: { gt: 0 },
        deleted_at: null,
        ...(sucursalValida ? { sucursal_id: query.sucursal_id } : {}),
      },
    });

    const montoVencer90Dias = lotesPorVencer.reduce(
      (acc, l) =>
        acc + l.stock_actual * Number(l.precio_compra_unidad_base || 0),
      0,
    );

    return {
      kpis: {
        total_ventas_hoy: totalVentasPeriodo,
        ganancia_neta_hoy: gananciaNetaPeriodo,
        margen_ganancia_pct: margenGananciaPct,
        costo_ventas_hoy: costoTotalCalculado,
        operaciones_hoy: cantidadOperaciones,
        ticket_promedio: ticketPromedio,
        total_ventas_ayer: totalVentasAnteriores,
        porcentaje_crecimiento: porcentajeCrecimiento,
        recetas_dispensadas_hoy: recetasDispensadasCount,
        lotes_vencer_90_dias_count: lotesPorVencer.length,
        monto_vencer_90_dias: montoVencer90Dias,
        pct_generico_vs_marca:
          totalItemsVendidosCount > 0
            ? Number(
                ((genericosCount / totalItemsVendidosCount) * 100).toFixed(1),
              )
            : 0,
        ultima_verificacion_stock: ahora.toISOString(),
      },
      progreso_capital: {
        meta_capital: metaCapital,
        recaudado: acumuladoRecuperado,
        pendiente: pendienteCapital,
        porcentaje_completado: porcentajeCapital,
        compras_inventario: comprasInventarioHistoricas,
        inversiones_adicionales: inversionesHistoricasTotal,
        gastos_operativos: gastosOperativosHistoricosTotal,
        ingresos_historicos: ingresosHistoricos,
        costo_ventas_historico: costoVentasHistorico,
        resultado_acumulado: resultadoAcumulado,
        margen_acumulado_pct: margenGlobalPct,
        venta_estimada_stock: proyeccionStock.venta_estimada,
        costo_stock_vigente: proyeccionStock.costo_stock,
        ganancia_estimada_stock: gananciaEstimadaStock,
        venta_estimada_minima: proyeccionStock.venta_estimada_minima,
        venta_estimada_maxima: proyeccionStock.venta_estimada_maxima,
        ganancia_estimada_minima: gananciaEstimadaMinima,
        ganancia_estimada_maxima: gananciaEstimadaMaxima,
      },
      grafico_7_dias: serieVentas7Dias,
      desglose_pagos: desglosedesPago,
      top_productos: topProductosVendidos,
      productos_rentables: productosMasRentables,
      top_clientes: topClientes,
      top_vendedores: topVendedores,
      alertas_stock: alertasStock,
    };
  }
}
