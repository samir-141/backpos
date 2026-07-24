import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getResumen(query: DashboardQueryDto) {
        this.logger.log(`Calculando métricas de Dashboard para sucursal: ${query.sucursal_id || 'Global'}`);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);

        // 1. Ventas de Hoy
        const ventasHoy = await this.prisma.ventas.findMany({
            where: {
                fecha: { gte: hoy, lt: manana },
                deleted_at: null,
                ...(query.sucursal_id
                    ? { cajas: { sucursal_id: query.sucursal_id } }
                    : {}),
            },
            include: {
                pagos: {
                    include: { metodos_pago: true }
                }
            }
        });

        const totalVentasHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total), 0);
        const cantidadOperacionesHoy = ventasHoy.length;
        const ticketPromedioHoy = cantidadOperacionesHoy > 0 ? totalVentasHoy / cantidadOperacionesHoy : 0;

        // 2. Ventas de Ayer (para % de crecimiento)
        const ventasAyer = await this.prisma.ventas.findMany({
            where: {
                fecha: { gte: ayer, lt: hoy },
                deleted_at: null,
                ...(query.sucursal_id
                    ? { cajas: { sucursal_id: query.sucursal_id } }
                    : {}),
            }
        });
        const totalVentasAyer = ventasAyer.reduce((acc, v) => acc + Number(v.total), 0);
        const porcentajeCrecimiento = totalVentasAyer > 0
            ? Number((((totalVentasHoy - totalVentasAyer) / totalVentasAyer) * 100).toFixed(1))
            : 100;

        // 3. Ventas de los últimos 7 días (para gráfico)
        const hace7dias = new Date(hoy);
        hace7dias.setDate(hace7dias.getDate() - 6);

        const ventasUltimos7Dias = await this.prisma.ventas.findMany({
            where: {
                fecha: { gte: hace7dias, lt: manana },
                deleted_at: null,
                ...(query.sucursal_id
                    ? { cajas: { sucursal_id: query.sucursal_id } }
                    : {}),
            },
            select: {
                fecha: true,
                total: true
            }
        });

        // Agrupar por día
        const ventasPorDiaMap = new Map<string, { fecha: string; dia: string; total: number; cantidad: number }>();
        for (let i = 0; i < 7; i++) {
            const d = new Date(hace7dias);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split('T')[0];
            const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'short' });
            ventasPorDiaMap.set(key, { fecha: key, dia: nombreDia, total: 0, cantidad: 0 });
        }

        ventasUltimos7Dias.forEach(v => {
            const key = new Date(v.fecha).toISOString().split('T')[0];
            if (ventasPorDiaMap.has(key)) {
                const item = ventasPorDiaMap.get(key)!;
                item.total += Number(v.total);
                item.cantidad += 1;
            }
        });

        const serieVentas7Dias = Array.from(ventasPorDiaMap.values());

        // 4. Métodos de Pago utilizados hoy
        const metodosMap = new Map<string, number>();
        ventasHoy.forEach(v => {
            v.pagos.forEach(p => {
                const nombreMetodo = p.metodos_pago?.nombre || p.referencia || 'EFECTIVO';
                const monto = Number(p.monto);
                metodosMap.set(nombreMetodo, (metodosMap.get(nombreMetodo) || 0) + monto);
            });
        });

        const desglosedesPago = Array.from(metodosMap.entries()).map(([metodo, monto]) => ({
            metodo,
            monto,
            porcentaje: totalVentasHoy > 0 ? Number(((monto / totalVentasHoy) * 100).toFixed(1)) : 0
        }));

        // 5. Productos más vendidos de hoy (Top 5)
        const detallesHoy = await this.prisma.detalles_ventas.findMany({
            where: {
                ventas: {
                    fecha: { gte: hoy, lt: manana },
                    deleted_at: null,
                    ...(query.sucursal_id
                        ? { cajas: { sucursal_id: query.sucursal_id } }
                        : {})
                },
                deleted_at: null
            },
            include: {
                productos_presentaciones: {
                    include: {
                        productos_comerciales: true,
                        unidades_presentacion: true
                    }
                }
            }
        });

        const productosVendidosMap = new Map<string, { id: string; nombre: string; presentacion: string; cantidad: number; total: number }>();
        detallesHoy.forEach(d => {
            const prodId = d.productos_presentaciones.productos_comerciales.id;
            const nombre = d.productos_presentaciones.productos_comerciales.nombre_comercial;
            const presentacion = d.productos_presentaciones.unidades_presentacion.nombre;
            const key = `${prodId}_${presentacion}`;

            if (!productosVendidosMap.has(key)) {
                productosVendidosMap.set(key, {
                    id: prodId,
                    nombre,
                    presentacion,
                    cantidad: 0,
                    total: 0
                });
            }
            const item = productosVendidosMap.get(key)!;
            item.cantidad += d.cantidad;
            item.total += Number(d.subtotal);
        });

        const topProductosVendidos = Array.from(productosVendidosMap.values())
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 5);

        // 6. Alertas de bajo stock (< 15 unidades base)
        const lotesBajoStock = await this.prisma.lotes.findMany({
            where: {
                stock_actual: { lte: 15 },
                deleted_at: null,
                ...(query.sucursal_id ? { sucursal_id: query.sucursal_id } : {})
            },
            include: {
                productos_comerciales: true
            },
            take: 8,
            orderBy: { stock_actual: 'asc' }
        });

        const alertasStock = lotesBajoStock.map(l => ({
            id: l.id,
            producto_comercial_id: l.producto_comercial_id,
            nombre_comercial: l.productos_comerciales.nombre_comercial,
            sku: l.productos_comerciales.sku,
            numero_lote: l.numero_lote,
            stock_actual: l.stock_actual,
            fecha_vencimiento: l.fecha_vencimiento,
        }));

        return {
            kpis: {
                total_ventas_hoy: totalVentasHoy,
                operaciones_hoy: cantidadOperacionesHoy,
                ticket_promedio: ticketPromedioHoy,
                total_ventas_ayer: totalVentasAyer,
                porcentaje_crecimiento: porcentajeCrecimiento,
            },
            grafico_7_dias: serieVentas7Dias,
            desglose_pagos: desglosedesPago,
            top_productos: topProductosVendidos,
            alertas_stock: alertasStock,
        };
    }
}
