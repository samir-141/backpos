import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';

@Injectable()
export class ClientesService {
    private readonly logger = new Logger(ClientesService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(query: QueryClientesDto) {
        const { page = 1, limit = 20, buscar, tipo_documento } = query;
        const skip = (page - 1) * limit;

        this.logger.log(`Listando clientes - Página: ${page}, Límite: ${limit}`);

        const where: any = {
            deleted_at: null,
        };

        if (tipo_documento) {
            where.tipo_documento = tipo_documento;
        }

        if (buscar) {
            where.OR = [
                { nombre: { contains: buscar, mode: 'insensitive' } },
                { numero_documento: { contains: buscar, mode: 'insensitive' } },
                { telefono: { contains: buscar, mode: 'insensitive' } },
                { email: { contains: buscar, mode: 'insensitive' } },
            ];
        }

        const [rows, total] = await Promise.all([
            this.prisma.clientes.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    ventas: {
                        where: { deleted_at: null },
                        select: {
                            id: true,
                            total: true,
                            fecha: true,
                        }
                    }
                }
            }),
            this.prisma.clientes.count({ where }),
        ]);

        const dataFormatted = rows.map(c => {
            const totalCompras = c.ventas.length;
            const montoTotalComprado = c.ventas.reduce((acc, v) => acc + Number(v.total), 0);
            const ultimaCompra = c.ventas.length > 0
                ? c.ventas.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0].fecha
                : null;

            return {
                id: c.id,
                tipo_documento: c.tipo_documento,
                numero_documento: c.numero_documento,
                nombre: c.nombre,
                direccion: c.direccion,
                telefono: c.telefono,
                email: c.email,
                total_compras: totalCompras,
                monto_total_comprado: montoTotalComprado,
                ultima_compra: ultimaCompra,
                created_at: c.created_at,
            };
        });

        return {
            data: dataFormatted,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };
    }

    async buscarPorDocumento(numeroDocumento: string) {
        this.logger.log(`Buscando cliente por documento: ${numeroDocumento}`);

        const cliente = await this.prisma.clientes.findFirst({
            where: {
                numero_documento: numeroDocumento.trim(),
                deleted_at: null,
            }
        });

        if (!cliente) {
            return { encontrado: false, cliente: null };
        }

        return { encontrado: true, cliente };
    }

    async consultarDocumentoPadron(tipo: string, numero: string) {
        const tipoDoc = (tipo || 'DNI').toUpperCase().trim();
        const numDoc = (numero || '').trim();

        this.logger.log(`Consultando padrón para ${tipoDoc}: ${numDoc}`);

        if (!numDoc) {
            return { encontrado: false, origen: 'NINGUNO', tipo_documento: tipoDoc, numero_documento: '', nombre: '', direccion: '' };
        }

        // 1. Buscar en BD local
        const clienteLocal = await this.prisma.clientes.findFirst({
            where: {
                tipo_documento: tipoDoc,
                numero_documento: numDoc,
                deleted_at: null,
            }
        });

        if (clienteLocal) {
            return {
                encontrado: true,
                origen: 'BASE_DATOS',
                tipo_documento: clienteLocal.tipo_documento,
                numero_documento: clienteLocal.numero_documento,
                nombre: clienteLocal.nombre,
                direccion: clienteLocal.direccion || '',
                telefono: clienteLocal.telefono || '',
                email: clienteLocal.email || '',
            };
        }

        // 2. Consulta Externa si es DNI (8 dígitos) o RUC (11 dígitos)
        try {
            if (tipoDoc === 'DNI' && numDoc.length === 8) {
                const response = await fetch(`https://api.apis.net.pe/v1/dni?numero=${numDoc}`);
                if (response.ok) {
                    const data = await response.json();
                    const nombreCompleto = data.nombre || `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
                    if (nombreCompleto) {
                        return {
                            encontrado: true,
                            origen: 'RENIEC',
                            tipo_documento: 'DNI',
                            numero_documento: numDoc,
                            nombre: nombreCompleto,
                            direccion: data.direccion || '',
                        };
                    }
                }
            } else if (tipoDoc === 'RUC' && numDoc.length === 11) {
                const response = await fetch(`https://api.apis.net.pe/v1/ruc?numero=${numDoc}`);
                if (response.ok) {
                    const data = await response.json();
                    const razonSocial = data.nombre || data.razonSocial;
                    if (razonSocial) {
                        return {
                            encontrado: true,
                            origen: 'SUNAT',
                            tipo_documento: 'RUC',
                            numero_documento: numDoc,
                            nombre: razonSocial,
                            direccion: data.direccion || data.direccionCompleta || '',
                        };
                    }
                }
            }
        } catch (err: any) {
            this.logger.warn(`Error al consultar servicio externo para ${tipoDoc} ${numDoc}: ${err.message}`);
        }

        return {
            encontrado: false,
            origen: 'NINGUNO',
            tipo_documento: tipoDoc,
            numero_documento: numDoc,
            nombre: '',
            direccion: '',
        };
    }


    async findOne(id: string) {
        const cliente = await this.prisma.clientes.findFirst({
            where: { id, deleted_at: null },
            include: {
                ventas: {
                    where: { deleted_at: null },
                    include: {
                        detalles_ventas: {
                            include: {
                                productos_presentaciones: {
                                    include: {
                                        productos_comerciales: true
                                    }
                                }
                            }
                        },
                        pagos: {
                            include: { metodos_pago: true }
                        }
                    },
                    orderBy: { fecha: 'desc' },
                    take: 20,
                }
            }
        });

        if (!cliente) {
            throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
        }

        const totalCompras = cliente.ventas.length;
        const montoTotalComprado = cliente.ventas.reduce((acc, v) => acc + Number(v.total), 0);

        return {
            ...cliente,
            total_compras: totalCompras,
            monto_total_comprado: montoTotalComprado,
        };
    }

    async create(dto: CreateClienteDto, usuarioId?: string) {
        this.logger.log(`Creando cliente: ${dto.nombre} (${dto.tipo_documento}: ${dto.numero_documento})`);

        // Validar documento único activo
        const existente = await this.prisma.clientes.findFirst({
            where: {
                tipo_documento: dto.tipo_documento,
                numero_documento: dto.numero_documento.trim(),
                deleted_at: null,
            }
        });

        if (existente) {
            throw new BadRequestException(`El cliente con ${dto.tipo_documento} ${dto.numero_documento} ya está registrado.`);
        }

        return await this.prisma.clientes.create({
            data: {
                tipo_documento: dto.tipo_documento,
                numero_documento: dto.numero_documento.trim(),
                nombre: dto.nombre.trim(),
                direccion: dto.direccion?.trim() || null,
                telefono: dto.telefono?.trim() || null,
                email: dto.email?.trim() || null,
                created_by: usuarioId,
            }
        });
    }

    async update(id: string, dto: UpdateClienteDto, usuarioId?: string) {
        this.logger.log(`Actualizando cliente con ID: ${id}`);

        const cliente = await this.prisma.clientes.findFirst({
            where: { id, deleted_at: null }
        });

        if (!cliente) {
            throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
        }

        if (dto.numero_documento && dto.tipo_documento) {
            const repetido = await this.prisma.clientes.findFirst({
                where: {
                    id: { not: id },
                    tipo_documento: dto.tipo_documento,
                    numero_documento: dto.numero_documento.trim(),
                    deleted_at: null,
                }
            });

            if (repetido) {
                throw new BadRequestException(`Ya existe otro cliente registrado con ${dto.tipo_documento} ${dto.numero_documento}.`);
            }
        }

        return await this.prisma.clientes.update({
            where: { id },
            data: {
                ...(dto.tipo_documento ? { tipo_documento: dto.tipo_documento } : {}),
                ...(dto.numero_documento ? { numero_documento: dto.numero_documento.trim() } : {}),
                ...(dto.nombre ? { nombre: dto.nombre.trim() } : {}),
                ...(dto.direccion !== undefined ? { direccion: dto.direccion?.trim() || null } : {}),
                ...(dto.telefono !== undefined ? { telefono: dto.telefono?.trim() || null } : {}),
                ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
                updated_by: usuarioId,
                updated_at: new Date(),
            }
        });
    }

    async remove(id: string, usuarioId?: string) {
        this.logger.log(`Eliminando cliente con ID: ${id}`);

        const cliente = await this.prisma.clientes.findFirst({
            where: { id, deleted_at: null }
        });

        if (!cliente) {
            throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
        }

        await this.prisma.clientes.update({
            where: { id },
            data: {
                deleted_at: new Date(),
                deleted_by: usuarioId,
            }
        });

        return { mensaje: `Cliente "${cliente.nombre}" eliminado correctamente` };
    }
}
