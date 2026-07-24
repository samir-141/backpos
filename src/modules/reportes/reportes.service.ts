import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryReportesDto } from './dto/query-reportes.dto';

@Injectable()
export class ReportesService {
    private readonly logger = new Logger(ReportesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getReporteVentas(query: QueryReportesDto) {
        this.logger.log(`Generando reporte de ventas para sucursal: ${query.sucursal_id || 'Global'}`);

        let fechaInicio = query.fecha_inicio ? new Date(`${query.fecha_inicio}T00:00:00.000Z`) : new Date();
        if (!query.fecha_inicio) {
            fechaInicio.setDate(fechaInicio.getDate() - 30); // Por defecto últimos 30 días
        }

        let fechaFin = query.fecha_fin ? new Date(`${query.fecha_fin}T23:59:59.999Z`) : new Date();

        const whereVentas: any = {
            fecha: { gte: fechaInicio, lte: fechaFin },
            deleted_at: null,
            ...(query.sucursal_id ? { cajas: { sucursal_id: query.sucursal_id } } : {}),
        };

        const ventas = await this.prisma.ventas.findMany({
            where: whereVentas,
            include: {
                detalles_ventas: {
                    include: {
                        lotes: true,
                        productos_presentaciones: {
                            include: { productos_comerciales: true }
                        }
                    }
                },
                pagos: {
                    include: { metodos_pago: true }
                },
                clientes: true,
            },
            orderBy: { fecha: 'desc' }
        });

        // Totales Financieros
        const totalVentas = ventas.reduce((acc, v) => acc + Number(v.total), 0);
        const subtotalBase = ventas.reduce((acc, v) => acc + Number(v.subtotal), 0);
        const igvTotal = ventas.reduce((acc, v) => acc + Number(v.igv), 0);
        const cantidadTransacciones = ventas.length;
        const ticketPromedio = cantidadTransacciones > 0 ? totalVentas / cantidadTransacciones : 0;

        // Calcular costo total para utilidad bruta estimada
        let costoTotalCompras = 0;
        ventas.forEach(v => {
            v.detalles_ventas.forEach(d => {
                const precioCompraUnitario = Number(d.lotes?.precio_compra_unidad_base || 0);
                const cantidadBase = d.cantidad * Number(d.productos_presentaciones?.cantidad_unidad_base || 1);
                costoTotalCompras += (precioCompraUnitario * cantidadBase);
            });
        });

        const utilidadBrutaEstimada = Math.max(0, subtotalBase - costoTotalCompras);

        // Desglose por Método de Pago
        const pagosMap = new Map<string, number>();
        ventas.forEach(v => {
            v.pagos.forEach(p => {
                const nombreMetodo = p.metodos_pago?.nombre || p.referencia || 'EFECTIVO';
                pagosMap.set(nombreMetodo, (pagosMap.get(nombreMetodo) || 0) + Number(p.monto));
            });
        });

        const desgloseMetodosPago = Array.from(pagosMap.entries()).map(([metodo, monto]) => ({
            metodo,
            monto,
            porcentaje: totalVentas > 0 ? Number(((monto / totalVentas) * 100).toFixed(1)) : 0
        }));

        // Lista simplificada de ventas para la tabla
        const listaVentas = ventas.map(v => ({
            id: v.id,
            fecha: v.fecha,
            cliente_nombre: v.clientes?.nombre || 'Cliente General',
            cliente_documento: v.clientes ? `${v.clientes.tipo_documento}: ${v.clientes.numero_documento}` : 'S/D',
            subtotal: Number(v.subtotal),
            igv: Number(v.igv),
            total: Number(v.total),
            items_count: v.detalles_ventas.length,
            metodo_pago: v.pagos[0]?.metodos_pago?.nombre || v.pagos[0]?.referencia || 'EFECTIVO',
            estado: v.estado,
        }));

        return {
            resumen_kpis: {
                total_ventas: totalVentas,
                subtotal_base: subtotalBase,
                igv_total: igvTotal,
                cantidad_transacciones: cantidadTransacciones,
                ticket_promedio: ticketPromedio,
                costo_compras_estimado: costoTotalCompras,
                utilidad_bruta_estimada: utilidadBrutaEstimada,
            },
            desglose_pagos: desgloseMetodosPago,
            ventas_lista: listaVentas,
            rango: {
                fecha_inicio: fechaInicio.toISOString().split('T')[0],
                fecha_fin: fechaFin.toISOString().split('T')[0],
            }
        };
    }

    async getReporteInventario(query: QueryReportesDto) {
        this.logger.log(`Generando reporte de inventario para sucursal: ${query.sucursal_id || 'Global'}`);

        const whereLotes: any = {
            deleted_at: null,
            ...(query.sucursal_id ? { sucursal_id: query.sucursal_id } : {}),
        };

        const lotes = await this.prisma.lotes.findMany({
            where: whereLotes,
            include: {
                productos_comerciales: {
                    include: {
                        productos_presentaciones: {
                            where: { deleted_at: null },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { fecha_vencimiento: 'asc' }
        });

        // 1. Valorización de Inventario
        let costoTotalInventario = 0;
        let valorVentaEstimado = 0;
        let totalUnidadesBase = 0;

        lotes.forEach(l => {
            const stock = l.stock_actual;
            const precioCompra = Number(l.precio_compra_unidad_base);
            const precioVenta = Number(l.productos_comerciales?.productos_presentaciones[0]?.precio_actual || (precioCompra * 1.3));

            costoTotalInventario += (stock * precioCompra);
            valorVentaEstimado += (stock * precioVenta);
            totalUnidadesBase += stock;
        });

        // 2. Control FEFO: Vencimientos próximos
        const hoy = new Date();
        const en30Dias = new Date(hoy);
        en30Dias.setDate(en30Dias.getDate() + 30);
        const en90Dias = new Date(hoy);
        en90Dias.setDate(en90Dias.getDate() + 90);

        const vencidos = lotes.filter(l => new Date(l.fecha_vencimiento) < hoy && l.stock_actual > 0);
        const porVencer30 = lotes.filter(l => new Date(l.fecha_vencimiento) >= hoy && new Date(l.fecha_vencimiento) <= en30Dias && l.stock_actual > 0);
        const porVencer90 = lotes.filter(l => new Date(l.fecha_vencimiento) > en30Dias && new Date(l.fecha_vencimiento) <= en90Dias && l.stock_actual > 0);

        const listaVencimientosFefo = lotes
            .filter(l => new Date(l.fecha_vencimiento) <= en90Dias && l.stock_actual > 0)
            .map(l => {
                const diasRestantes = Math.ceil((new Date(l.fecha_vencimiento).getTime() - hoy.getTime()) / (1000 * 3600 * 24));
                let estadoVencimiento = 'EN_FECHA';
                if (diasRestantes <= 0) estadoVencimiento = 'VENCIDO';
                else if (diasRestantes <= 30) estadoVencimiento = 'URGENTE';
                else if (diasRestantes <= 90) estadoVencimiento = 'ADVERTENCIA';

                return {
                    id: l.id,
                    producto: l.productos_comerciales.nombre_comercial,
                    sku: l.productos_comerciales.sku,
                    numero_lote: l.numero_lote,
                    stock_actual: l.stock_actual,
                    fecha_vencimiento: l.fecha_vencimiento,
                    dias_restantes: diasRestantes,
                    estado: estadoVencimiento,
                };
            });

        // 3. Stock Bajo y Agotados
        const lotesCriticos = lotes.filter(l => l.stock_actual <= 15).map(l => ({
            id: l.id,
            producto: l.productos_comerciales.nombre_comercial,
            sku: l.productos_comerciales.sku,
            stock_actual: l.stock_actual,
            numero_lote: l.numero_lote,
        }));

        return {
            valorizacion: {
                costo_total_inventario: costoTotalInventario,
                valor_venta_estimado: valorVentaEstimado,
                margen_potencial: Math.max(0, valorVentaEstimado - costoTotalInventario),
                total_unidades_base: totalUnidadesBase,
                total_lotes: lotes.length,
            },
            control_vencimientos: {
                vencidos_count: vencidos.length,
                urgentes_30_dias_count: porVencer30.length,
                advertencia_90_dias_count: porVencer90.length,
                lista: listaVencimientosFefo,
            },
            stock_critico: lotesCriticos,
        };
    }
}
