// src/reportes/reportes.controller.ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('reportes')
export class ReportesController {
    constructor(private readonly prisma: PrismaService) { }

    // 1. Gráfico de Evolución de Ventas (Agrupado por Fecha)
    @Get('ventas-grafico')
    async getVentasGrafico() {
        const agrupado = await this.prisma.ventas.groupBy({
            by: ['fecha'],
            where: {
                estado: 'EMITIDO',
                deleted_at: null,
            },
            _sum: { total: true },
            _count: { id: true },
            _avg: { total: true },
            orderBy: { fecha: 'asc' },
        });

        // Formateamos la respuesta para que el Frontend reciba las llaves exactas de tu interfaz VentaGrafico
        return agrupado.map((v) => ({
            fecha: v.fecha.toISOString().split('T')[0], // Convierte el Date de la BD a 'YYYY-MM-DD'
            total: Number(v._sum.total || 0),
            cantidad_ventas: v._count.id,
            promedio_ventas: Number(v._avg.total || 0),
        }));
    }

    // 2. Ranking de Métodos de Pago
    @Get('metodos-pago')
    async getMetodosPago() {
        const pagosAgrupados = await this.prisma.pagos.groupBy({
            by: ['metodo_pago_id'],
            where: {
                ventas: {
                    estado: 'EMITIDO',
                    deleted_at: null,
                },
            },
            _sum: { monto: true },
        });

        // Como groupBy no hace JOINs directos en los objetos devueltos, 
        // resolvemos los nombres de los métodos en paralelo
        return Promise.all(
            pagosAgrupados.map(async (p) => {
                const metodo = await this.prisma.metodos_pago.findUnique({
                    where: { id: p.metodo_pago_id },
                    select: { nombre: true },
                });
                return {
                    metodo: metodo?.nombre || 'Desconocido',
                    monto: Number(p._sum.monto || 0),
                };
            })
        );
    }

    // 3. Ventas por Categoría (Gráfico Circular)
    // Nota: Para reportes con relaciones triples (Venta -> Detalle -> Presentación -> Producto -> Categoría),
    // Prisma requiere traer el detalle e indexar en memoria para mantenerlo 100% ORM.
    @Get('ventas-categoria')
    async getVentasCategoria() {
        const detalles = await this.prisma.detalles_ventas.findMany({
            where: {
                ventas: {
                    estado: 'EMITIDO',
                    deleted_at: null,
                },
            },
            include: {
                productos_presentaciones: {
                    include: {
                        productos_comerciales: {
                            include: { categorias: true },
                        },
                    },
                },
            },
        });

        // Agrupamos en memoria usando la respuesta tipada de Prisma
        const mapa = detalles.reduce((acc, curr) => {
            const nombreCat = curr.productos_presentaciones.productos_comerciales.categorias.nombre;
            if (!acc[nombreCat]) {
                acc[nombreCat] = { categoria: nombreCat, total: 0, cantidad: 0 };
            }
            acc[nombreCat].total += Number(curr.subtotal);
            acc[nombreCat].cantidad += curr.cantidad;
            return acc;
        }, {} as Record<string, { categoria: string; total: number; cantidad: number }>);

        return Object.values(mapa).sort((a, b) => b.total - a.total);
    }

    // 4. Ventas por Cajero
    @Get('ventas-cajero')
    async getVentasPorCajero() {
        const ventasPorUsuario = await this.prisma.ventas.groupBy({
            by: ['usuario_id'],
            where: {
                estado: 'EMITIDO',
                deleted_at: null,
            },
            _sum: { total: true },
        });

        return Promise.all(
            ventasPorUsuario.map(async (v) => {
                const usuario = await this.prisma.usuarios.findUnique({
                    where: { id: v.usuario_id },
                    select: { nombre: true },
                });
                return {
                    cajero: usuario?.nombre || 'Desconocido',
                    total: Number(v._sum.total || 0),
                };
            })
        );
    }

    // 5. Top Productos Más Vendidos
    @Get('top-productos')
    async getTopProductos() {
        const agrupado = await this.prisma.detalles_ventas.groupBy({
            by: ['producto_presentacion_id'],
            where: {
                ventas: {
                    estado: 'EMITIDO',
                    deleted_at: null,
                },
            },
            _sum: {
                cantidad: true,
                subtotal: true,
            },
            orderBy: {
                _sum: { subtotal: 'desc' },
            },
            take: 5,
        });

        return Promise.all(
            agrupado.map(async (item) => {
                const presentacion = await this.prisma.productos_presentaciones.findUnique({
                    where: { id: item.producto_presentacion_id },
                    include: { productos_comerciales: true },
                });
                return {
                    id: presentacion?.productos_comerciales.id,
                    nombre: presentacion?.productos_comerciales.nombre_comercial || 'Desconocido',
                    cantidad: item._sum.cantidad || 0,
                    total: Number(item._sum.subtotal || 0),
                };
            })
        );
    }
}