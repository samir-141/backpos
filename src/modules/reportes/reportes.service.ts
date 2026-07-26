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
        fechaInicio.setDate(fechaInicio.getDate() - 90); // Últimos 90 días por defecto

        if (query.fecha_inicio) {
            fechaInicio = new Date(`${query.fecha_inicio}T00:00:00.000Z`);
        }

        let fechaFin = new Date();
        fechaFin.setDate(fechaFin.getDate() + 2); // 2 días de margen para cubrir zonas horarias

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

        // Lista detallada de ventas con ítems comprados
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
                costo_compras_estimado: costoTotalCompras,
                utilidad_bruta_estimada: utilidadBrutaEstimada,
            },
            desglose_pagos: desgloseMetodosPago,
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

        const valorTotalInventario = lotes.reduce((acc, l) => acc + (l.stock_actual * Number(l.precio_compra_unidad_base || 0)), 0);
        const totalItemsLotes = lotes.length;
        const lotesPorVencerCount = lotes.filter(l => {
            const diasVencimiento = Math.ceil((new Date(l.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return diasVencimiento <= 60 && diasVencimiento > 0;
        }).length;
        const lotesAgotadosCount = lotes.filter(l => l.stock_actual <= 0).length;

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
                valor_total_inventario: valorTotalInventario,
                total_lotes: totalItemsLotes,
                lotes_por_vencer: lotesPorVencerCount,
                lotes_agotados: lotesAgotadosCount,
            },
            lotes_lista: lotesLista,
        };
    }
}
