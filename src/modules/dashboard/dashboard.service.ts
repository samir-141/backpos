import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getResumen(query: DashboardQueryDto) {
        this.logger.log(`Calculando métricas de Dashboard Financiero Avanzado para sucursal: ${query.sucursal_id || 'Global'}`);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);

        const sucursalValida = query.sucursal_id && query.sucursal_id !== 'undefined' && query.sucursal_id !== 'null';

        // 1. Ventas de Hoy
        const ventasHoy = await this.prisma.ventas.findMany({
            where: {
                fecha: { gte: hoy, lt: manana },
                deleted_at: null,
                ...(sucursalValida ? { cajas: { sucursal_id: query.sucursal_id } } : {}),
            },
            include: {
                pagos: {
                    include: { metodos_pago: true }
                },
                detalles_ventas: {
                    include: { lotes: true }
                },
                clientes: true,
                usuarios: true,
            }
        });

        const totalVentasHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total), 0);
        const cantidadOperacionesHoy = ventasHoy.length;
        const ticketPromedioHoy = cantidadOperacionesHoy > 0 ? totalVentasHoy / cantidadOperacionesHoy : 0;

        // Calcular Ganancia Neta / Utilidad Bruta de Hoy
        let costoComprasHoy = 0;
        ventasHoy.forEach(v => {
            v.detalles_ventas.forEach(d => {
                const precioCompraUnitario = Number(d.lotes?.precio_compra_unidad_base || 0);
                const equivBase = Number((d as any).productos_presentaciones?.cantidad_unidad_base || 1);
                costoComprasHoy += (precioCompraUnitario * d.cantidad * equivBase);
            });
        });
        const gananciaNetaHoy = Math.max(0, totalVentasHoy - costoComprasHoy);
        const margenGananciaPct = totalVentasHoy > 0 ? Number(((gananciaNetaHoy / totalVentasHoy) * 100).toFixed(1)) : 0;

        // 2. Ventas de Ayer (para % de crecimiento)
        const ventasAyer = await this.prisma.ventas.findMany({
            where: {
                fecha: { gte: ayer, lt: hoy },
                deleted_at: null,
                ...(sucursalValida ? { cajas: { sucursal_id: query.sucursal_id } } : {}),
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
                ...(sucursalValida ? { cajas: { sucursal_id: query.sucursal_id } } : {}),
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

        // 4. Desglose Métodos de Pago utilizados hoy
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

        // 5. Productos más vendidos y más rentables de hoy
        const detallesHoy = await this.prisma.detalles_ventas.findMany({
            where: {
                ventas: {
                    fecha: { gte: hoy, lt: manana },
                    deleted_at: null,
                    ...(sucursalValida ? { cajas: { sucursal_id: query.sucursal_id } } : {})
                },
                deleted_at: null
            },
            include: {
                lotes: true,
                productos_presentaciones: {
                    include: {
                        productos_comerciales: true,
                        unidades_presentacion: true
                    }
                }
            }
        });

        const productosMap = new Map<string, { id: string; nombre: string; presentacion: string; cantidad: number; ingresos: number; costo: number; ganancia: number }>();
        detallesHoy.forEach(d => {
            const prodId = d.productos_presentaciones.productos_comerciales.id;
            const nombre = d.productos_presentaciones.productos_comerciales.nombre_comercial;
            const presentacion = d.productos_presentaciones.unidades_presentacion.nombre;
            const key = `${prodId}_${presentacion}`;

            const subtotal = Number(d.subtotal);
            const costoUnit = Number(d.lotes?.precio_compra_unidad_base || 0);
            const equivBase = Number(d.productos_presentaciones.cantidad_unidad_base || 1);
            const costoTotal = (costoUnit * d.cantidad * equivBase);

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
            item.ganancia += Math.max(0, subtotal - costoTotal);
        });

        const topProductosVendidos = Array.from(productosMap.values())
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 5)
            .map(p => ({
                id: p.id,
                nombre: p.nombre,
                presentacion: p.presentacion,
                cantidad: p.cantidad,
                total: p.ingresos
            }));

        const productosMasRentables = Array.from(productosMap.values())
            .sort((a, b) => b.ganancia - a.ganancia)
            .slice(0, 5)
            .map(p => ({
                id: p.id,
                nombre: p.nombre,
                presentacion: p.presentacion,
                cantidad: p.cantidad,
                ingresos: p.ingresos,
                ganancia_neta: p.ganancia,
                margen_pct: p.ingresos > 0 ? Number(((p.ganancia / p.ingresos) * 100).toFixed(1)) : 0
            }));

        // 6. Top Mejores Clientes (Historico general)
        const ventasTodas = await this.prisma.ventas.findMany({
            where: {
                deleted_at: null,
                ...(sucursalValida ? { cajas: { sucursal_id: query.sucursal_id } } : {}),
            },
            include: { clientes: true, usuarios: true }
        });

        const clientesMap = new Map<string, { id: string; nombre: string; documento: string; total_comprado: number; compras_count: number }>();
        ventasTodas.forEach(v => {
            if (v.clientes) {
                const cId = v.clientes.id;
                if (!clientesMap.has(cId)) {
                    clientesMap.set(cId, {
                        id: cId,
                        nombre: v.clientes.nombre,
                        documento: `${v.clientes.tipo_documento}: ${v.clientes.numero_documento}`,
                        total_comprado: 0,
                        compras_count: 0
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

        // 7. Top Vendedores / Cajeros (Desempeño)
        const vendedoresMap = new Map<string, { id: string; nombre: string; correo: string; total_facturado: number; operaciones_count: number }>();
        ventasTodas.forEach(v => {
            if (v.usuarios) {
                const uId = v.usuarios.id;
                if (!vendedoresMap.has(uId)) {
                    vendedoresMap.set(uId, {
                        id: uId,
                        nombre: v.usuarios.nombre,
                        correo: v.usuarios.correo,
                        total_facturado: 0,
                        operaciones_count: 0
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

        // 8. Retorno y Progreso de Capital (Meta de Capital de Inversión)
        const metaCapital = 50000.00; // Meta de capital de inversión por defecto S/ 50,000.00
        const totalVentasHistorico = ventasTodas.reduce((acc, v) => acc + Number(v.total), 0);
        const acumuladoRecuperado = totalVentasHistorico;
        const pendienteCapital = Math.max(0, metaCapital - acumuladoRecuperado);
        const porcentajeCapital = Math.min(100, Number(((acumuladoRecuperado / metaCapital) * 100).toFixed(1)));

        // 9. Alertas de bajo stock (< 15 unidades base)
        const lotesBajoStock = await this.prisma.lotes.findMany({
            where: {
                stock_actual: { lte: 15 },
                deleted_at: null,
                ...(sucursalValida ? { sucursal_id: query.sucursal_id } : {})
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
                ganancia_neta_hoy: gananciaNetaHoy,
                margen_ganancia_pct: margenGananciaPct,
                operaciones_hoy: cantidadOperacionesHoy,
                ticket_promedio: ticketPromedioHoy,
                total_ventas_ayer: totalVentasAyer,
                porcentaje_crecimiento: porcentajeCrecimiento,
            },
            progreso_capital: {
                meta_capital: metaCapital,
                recaudado: acumuladoRecuperado,
                pendiente: pendienteCapital,
                porcentaje_completado: porcentajeCapital,
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
