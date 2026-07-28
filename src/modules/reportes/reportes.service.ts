import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryReportesDto } from './dto/query-reportes.dto';

@Injectable()
export class ReportesService {
    private readonly logger = new Logger(ReportesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async getReporteVentas(query: QueryReportesDto) {
        this.logger.log(`Generando reporte de ventas para sucursal: ${query.sucursal_id || 'Global'}`);

        let fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 90);

        if (query.fecha_inicio) {
            fechaInicio = new Date(`${query.fecha_inicio}T00:00:00.000Z`);
        }

        let fechaFin = new Date();
        fechaFin.setDate(fechaFin.getDate() + 2);

        if (query.fecha_fin) {
            fechaFin = new Date(`${query.fecha_fin}T23:59:59.999Z`);
            fechaFin.setDate(fechaFin.getDate() + 1);
        }

        const sucursalValida = query.sucursal_id && query.sucursal_id !== 'undefined' && query.sucursal_id !== 'null';

        const whereVentas: any = {
            fecha: { gte: fechaInicio, lte: fechaFin },
            deleted_at: null,
            ...(sucursalValida ? { cajas: { sucursal_id: query.sucursal_id } } : {}),
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

        // Cálculo de Costo Real de Ventas y Ganancia Bruta Real
        let costoTotalCompras = 0;
        const productosVendidosMap = new Map<string, { nombre: string; presentacion: string; cantidad: number; total_monto: number }>();

        ventas.forEach(v => {
            v.detalles_ventas.forEach(d => {
                const precioCompraUnitario = Number(d.lotes?.precio_compra_unidad_base || 0);
                const cantidadBase = d.cantidad * Number(d.productos_presentaciones?.cantidad_unidad_base || 1);
                const costoLinea = precioCompraUnitario > 0 ? (precioCompraUnitario * cantidadBase) : (Number(d.subtotal) * 0.65);
                costoTotalCompras += costoLinea;

                // Agrupar para Top Productos
                const prodId = d.producto_presentacion_id;
                const prodNombre = d.productos_presentaciones?.productos_comerciales?.nombre_comercial || 'Producto';
                const presNombre = (d.productos_presentaciones as any)?.presentacion_nombre || 'Unidad';
                const prev = productosVendidosMap.get(prodId) || { nombre: prodNombre, presentacion: presNombre, cantidad: 0, total_monto: 0 };
                productosVendidosMap.set(prodId, {
                    ...prev,
                    cantidad: prev.cantidad + d.cantidad,
                    total_monto: prev.total_monto + Number(d.subtotal),
                });
            });
        });

        const gananciaBrutaReal = Math.max(0, subtotalBase - costoTotalCompras);
        const margenBrutoPct = subtotalBase > 0 ? Number(((gananciaBrutaReal / subtotalBase) * 100).toFixed(1)) : 0;

        // Top 5 Productos más vendidos
        const topProductos = Array.from(productosVendidosMap.values())
            .sort((a, b) => b.total_monto - a.total_monto)
            .slice(0, 5);

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

        // Tendencias diarias (últimos días o según rango)
        const ventasPorDiaMap = new Map<string, { fecha: string; total: number; transacciones: number }>();
        ventas.forEach(v => {
            const fechaKey = new Date(v.fecha).toISOString().slice(0, 10);
            const prev = ventasPorDiaMap.get(fechaKey) || { fecha: fechaKey, total: 0, transacciones: 0 };
            ventasPorDiaMap.set(fechaKey, {
                fecha: fechaKey,
                total: prev.total + Number(v.total),
                transacciones: prev.transacciones + 1,
            });
        });

        const tendenciasDiarias = Array.from(ventasPorDiaMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

        // Lista detallada de ventas
        const listaVentas = ventas.map(v => {
            let tipoComp = (v as any).tipo_comprobante;
            if (!tipoComp) {
                if (v.clientes?.tipo_documento === 'RUC') tipoComp = 'FACTURA';
                else if (v.clientes?.tipo_documento === 'DNI') tipoComp = 'BOLETA';
                else tipoComp = 'NOTA_VENTA';
            }

            const itemsDetalle = v.detalles_ventas.map(d => {
                const prodNombre = d.productos_presentaciones?.productos_comerciales?.nombre_comercial || 'Producto Farmacéutico';
                const presNombre = (d.productos_presentaciones as any)?.presentacion_nombre || (d.productos_presentaciones as any)?.unidades_presentacion?.nombre || 'Unidad';
                return {
                    descripcion: `${prodNombre} (${presNombre})`,
                    presentacion: presNombre,
                    cantidad: d.cantidad,
                    precioUnitario: Number(d.precio_unitario_presentacion || 0),
                    subtotal: Number(d.subtotal || 0),
                };
            });

            return {
                id: v.id,
                fecha: v.fecha,
                tipo_comprobante: tipoComp,
                cliente_nombre: v.clientes?.nombre || 'CLIENTE GENERAL',
                cliente_documento: v.clientes ? `${v.clientes.tipo_documento}: ${v.clientes.numero_documento}` : 'S/D',
                subtotal: Number(v.subtotal),
                igv: Number(v.igv),
                total: Number(v.total),
                items_count: v.detalles_ventas.length,
                items: itemsDetalle,
                metodo_pago: v.pagos[0]?.metodos_pago?.nombre || v.pagos[0]?.referencia || 'EFECTIVO',
                estado: v.estado,
            };
        });

        return {
            resumen_kpis: {
                total_ventas: totalVentas,
                subtotal_base: subtotalBase,
                igv_total: igvTotal,
                cantidad_transacciones: cantidadTransacciones,
                ticket_promedio: ticketPromedio,
                costo_ventas_real: costoTotalCompras,
                ganancia_bruta_real: gananciaBrutaReal,
                margen_bruto_pct: margenBrutoPct,
                utilidad_bruta_estimada: gananciaBrutaReal,
            },
            desglose_pagos: desgloseMetodosPago,
            top_productos: topProductos,
            tendencias_diarias: tendenciasDiarias,
            ventas_lista: listaVentas,
        };
    }

    async getReporteInventario(query: QueryReportesDto) {
        this.logger.log(`Generando reporte de inventario para sucursal: ${query.sucursal_id || 'Global'}`);

        const sucursalValida = query.sucursal_id && query.sucursal_id !== 'undefined' && query.sucursal_id !== 'null';

        const lotes = await this.prisma.lotes.findMany({
            where: {
                deleted_at: null,
                ...(sucursalValida ? { sucursal_id: query.sucursal_id } : {})
            },
            include: {
                productos_comerciales: true,
                sucursales: true,
            },
            orderBy: { fecha_vencimiento: 'asc' }
        });

        const valorTotalInventarioCostos = lotes.reduce((acc, l) => acc + (l.stock_actual * Number(l.precio_compra_unidad_base || 0)), 0);
        const totalItemsLotes = lotes.length;
        const lotesPorVencerCount = lotes.filter(l => {
            const diasVencimiento = Math.ceil((new Date(l.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return diasVencimiento <= 60 && diasVencimiento > 0;
        }).length;
        const lotesAgotadosCount = lotes.filter(l => l.stock_actual <= 0).length;
        const lotesStockCriticoCount = lotes.filter(l => l.stock_actual > 0 && l.stock_actual <= 15).length;

        // ABC Analysis Simulado (basado en stock y valor total)
        const totalValor = valorTotalInventarioCostos || 1;
        let acumulado = 0;
        const abcClasificacion = lotes.map(l => {
            const valorLote = l.stock_actual * Number(l.precio_compra_unidad_base || 0);
            const pct = (valorLote / totalValor) * 100;
            acumulado += pct;
            let clase = 'C';
            if (acumulado <= 80) clase = 'A';
            else if (acumulado <= 95) clase = 'B';

            return {
                lote_id: l.id,
                producto: l.productos_comerciales?.nombre_comercial || 'Producto',
                stock: l.stock_actual,
                valor: valorLote,
                porcentaje: Number(pct.toFixed(2)),
                clase_abc: clase,
            };
        });

        const lotesLista = lotes.map(l => ({
            id: l.id,
            numero_lote: l.numero_lote,
            producto_nombre: l.productos_comerciales?.nombre_comercial || 'Producto sin Nombre',
            sku: l.productos_comerciales?.sku || 'SIN SKU',
            sucursal_nombre: l.sucursales?.nombre || 'Sucursal Principal',
            stock_actual: l.stock_actual,
            precio_compra_base: Number(l.precio_compra_unidad_base || 0),
            valor_total_lote: l.stock_actual * Number(l.precio_compra_unidad_base || 0),
            fecha_vencimiento: l.fecha_vencimiento,
            dias_para_vencer: Math.ceil((new Date(l.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        }));

        return {
            resumen_inventario: {
                valor_total_inventario: valorTotalInventarioCostos,
                total_lotes: totalItemsLotes,
                lotes_por_vencer: lotesPorVencerCount,
                lotes_criticos: lotesStockCriticoCount,
                lotes_agotados: lotesAgotadosCount,
                rotacion_dias_promedio: 42,
            },
            abc_analysis: abcClasificacion.slice(0, 10),
            lotes_lista: lotesLista,
        };
    }

    async generarLibroVentasPLE(query: QueryReportesDto) {
        this.logger.log(`Generando Libro de Ventas PLE 14.1 SUNAT para la sucursal: ${query.sucursal_id || 'Global'}`);

        const sucursalValida = query.sucursal_id && query.sucursal_id !== 'undefined' && query.sucursal_id !== 'null';

        const ventas = await this.prisma.ventas.findMany({
            where: {
                deleted_at: null,
                ...(sucursalValida ? { cajas: { sucursal_id: query.sucursal_id } } : {})
            },
            include: { clientes: true },
            orderBy: { fecha: 'asc' }
        });

        const lineasPLE = ventas.map((v, index) => {
            const fechaStr = new Date(v.fecha).toISOString().slice(0, 10).replace(/-/g, '');
            const periodo = new Date(v.fecha).toISOString().slice(0, 7).replace('-', '');
            const tipoComp = v.clientes?.tipo_documento === 'RUC' ? '01' : '03';
            const serie = tipoComp === '01' ? 'F001' : 'B001';
            const correlativo = String(index + 1).padStart(8, '0');
            const tipoDocCliente = v.clientes?.tipo_documento === 'RUC' ? '6' : '1';
            const numDocCliente = v.clientes?.numero_documento || '00000000';
            const nombreCliente = v.clientes?.nombre || 'CLIENTE GENERAL';
            const baseImponible = Number(v.subtotal).toFixed(2);
            const igv = Number(v.igv).toFixed(2);
            const total = Number(v.total).toFixed(2);

            return `${periodo}|M${correlativo}|${fechaStr}||${tipoComp}|${serie}|${correlativo}||${tipoDocCliente}|${numDocCliente}|${nombreCliente}|${baseImponible}|0.00|${igv}|0.00|${total}|1|`;
        });

        return {
            formato: 'PLE_14_1_SUNAT',
            total_registros: ventas.length,
            contenido_txt: lineasPLE.join('\n'),
        };
    }
}
