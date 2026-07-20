import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleDestroy() {
        await this.$disconnect();
    }
    constructor() {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL,
        });
        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async test() {
        return this.$queryRaw`SELECT NOW()`;
    }

    // 1. LISTADO MAESTRO DE LABORATORIOS (Para selectores o filtros)
    async findLaboratorios() {
        return this.laboratorios.findMany({
            where: { deleted_at: null }, // Ignora eliminados (Soft Delete)
            orderBy: { nombre: 'asc' }
        });
    }

    // 2. CATÁLOGO COMPLETO DE PRODUCTOS COMERCIALES (Con sus relaciones desanidadas)
    // Caso de Uso 12, 13, 14: Ideal para la tabla principal del inventario en el Frontend
    async findProductosCatalogo() {
        return this.productos_comerciales.findMany({
            where: { deleted_at: null, estado: 'ACTIVO' },
            include: {
                medicamentos: {
                    include: {
                        principios_activos: true,
                        formas_farmaceuticas: true
                    }
                },
                laboratorios: true,
                unidades_presentacion: true // Su unidad base genérica
            }
        });
    }

    // 3. ESCANEAR CÓDIGO DE BARRAS (Caso de Uso 11)
    // El frontend manda el string escaneado y esto le devuelve el producto exacto con su factor de conversión
    async findProductoPorCodigoBarras(codigoBarras: string) {
        return this.productos_presentaciones.findFirst({
            where: {
                codigo_barras: codigoBarras,
                deleted_at: null
            },
            include: {
                productos_comerciales: {
                    include: {
                        medicamentos: {
                            include: {
                                principios_activos: true,
                                formas_farmaceuticas: true
                            }
                        },
                        laboratorios: true
                    }
                },
                unidades_presentacion: true // Muestra si es Caja, Blíster, etc.
            }
        });
    }

    // 4. VER INVENTARIO ACTUAL Y LOTES DISPONIBLES EN TIEMPO REAL (Caso de Uso 8, 9 y 29)
    // Aplica la estrategia FEFO de manera automática ordenando por vencimiento próximo
    async findStockFefoPorProducto(productoComercialId: string) {
        return this.lotes.findMany({
            where: {
                producto_comercial_id: productoComercialId,
                stock_actual: { gt: 0 }, // Solo lotes con stock mayor a cero ( > 0 )
                deleted_at: null
            },
            orderBy: {
                fecha_vencimiento: 'asc' // FEFO: El que vence primero va arriba
            }
        });
    }

    // 5. ALERTAS DE VENCIMIENTO A 30 DÍAS (Caso de Uso 15)
    // Envía al dashboard del Frontend la lista de productos críticos por expirar
    async findProductosPorVencer() {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() + 30); // Hoy + 30 días

        return this.lotes.findMany({
            where: {
                fecha_vencimiento: {
                    lte: fechaLimite,
                    gte: new Date() // Que no hayan vencido aún hoy
                },
                stock_actual: { gt: 0 },
                deleted_at: null
            },
            include: {
                productos_comerciales: true
            },
            orderBy: {
                fecha_vencimiento: 'asc'
            }
        });
    }
}