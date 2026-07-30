import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';

@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(boticaId: string, query: QueryClientesDto) {
    const {
      page = 1,
      limit = 20,
      buscar,
      tipo_documento,
      tipo_cliente,
      estado,
      estado_credito,
      condicion_contribuyente,
    } = query;
    const skip = (page - 1) * limit;

    this.logger.log(`Listando clientes - Página: ${page}, Límite: ${limit}`);

    const where: any = {
      deleted_at: null,
      botica_id: boticaId,
    };

    if (tipo_documento) where.tipo_documento = tipo_documento;
    if (tipo_cliente) where.tipo_cliente = tipo_cliente;
    if (estado) where.estado = estado;
    if (estado_credito) where.estado_credito = estado_credito;
    if (condicion_contribuyente)
      where.condicion_contribuyente = condicion_contribuyente;

    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar, mode: 'insensitive' } },
        { numero_documento: { contains: buscar, mode: 'insensitive' } },
        { telefono: { contains: buscar, mode: 'insensitive' } },
        { email: { contains: buscar, mode: 'insensitive' } },
        { whatsapp: { contains: buscar, mode: 'insensitive' } },
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
            },
          },
        },
      }),
      this.prisma.clientes.count({ where }),
    ]);

    const dataFormatted = rows.map((c) => {
      const totalCompras = c.ventas.length;
      const montoTotalComprado = c.ventas.reduce(
        (acc, v) => acc + Number(v.total),
        0,
      );
      const ultimaCompra =
        c.ventas.length > 0
          ? c.ventas.sort(
              (a, b) =>
                new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
            )[0].fecha
          : null;

      return {
        id: c.id,
        tipo_documento: c.tipo_documento,
        numero_documento: c.numero_documento,
        nombre: c.nombre,
        direccion: c.direccion,
        telefono: c.telefono,
        email: c.email,
        tipo_cliente: c.tipo_cliente || 'NATURAL',
        condicion_contribuyente: c.condicion_contribuyente || 'HABIDO',
        estado_sunat: c.estado_sunat || 'ACTIVO',
        estado: c.estado || 'ACTIVO',
        limite_credito: Number(c.limite_credito || 0),
        dias_credito: Number(c.dias_credito || 0),
        saldo_actual: Number(c.saldo_actual || 0),
        estado_credito: c.estado_credito || 'AL CORRIENTE',
        whatsapp: c.whatsapp,
        contacto_principal: c.contacto_principal,
        cargo_contacto: c.cargo_contacto,
        representante_legal: c.representante_legal,
        dni_representante: c.dni_representante,
        fecha_nacimiento: c.fecha_nacimiento,
        observaciones: c.observaciones,
        origen: c.origen,
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
      },
    };
  }

  async buscarPorDocumento(boticaId: string, numeroDocumento: string) {
    this.logger.log(`Buscando cliente por documento: ${numeroDocumento}`);

    const cliente = await this.prisma.clientes.findFirst({
      where: {
        numero_documento: numeroDocumento.trim(),
        deleted_at: null,
        botica_id: boticaId,
      },
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
      return {
        encontrado: false,
        origen: 'NINGUNO',
        tipo_documento: tipoDoc,
        numero_documento: '',
        nombre: '',
        direccion: '',
      };
    }

    // 1. Buscar en BD local
    const clienteLocal = await this.prisma.clientes.findFirst({
      where: {
        tipo_documento: tipoDoc,
        numero_documento: numDoc,
        deleted_at: null,
      },
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
        tipo_cliente: clienteLocal.tipo_cliente || 'NATURAL',
        condicion_contribuyente:
          clienteLocal.condicion_contribuyente || 'HABIDO',
      };
    }

    // 2. Consulta Externa si es DNI (8 dígitos) o RUC (11 dígitos)
    try {
      if (tipoDoc === 'DNI' && numDoc.length === 8) {
        const response = await fetch(
          `https://api.apis.net.pe/v1/dni?numero=${numDoc}`,
        );
        if (response.ok) {
          const data = await response.json();
          const nombreCompleto =
            data.nombre ||
            `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
          if (nombreCompleto) {
            return {
              encontrado: true,
              origen: 'RENIEC',
              tipo_documento: 'DNI',
              numero_documento: numDoc,
              nombre: nombreCompleto,
              direccion: data.direccion || '',
              tipo_cliente: 'NATURAL',
              condicion_contribuyente: 'HABIDO',
            };
          }
        }
      } else if (tipoDoc === 'RUC' && numDoc.length === 11) {
        const response = await fetch(
          `https://api.apis.net.pe/v1/ruc?numero=${numDoc}`,
        );
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
              tipo_cliente: 'JURIDICO',
              condicion_contribuyente: data.condicion || 'HABIDO',
              estado_sunat: data.estado || 'ACTIVO',
            };
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Error al consultar servicio externo para ${tipoDoc} ${numDoc}: ${err.message}`,
      );
    }

    return {
      encontrado: false,
      origen: 'NINGUNO',
      tipo_documento: tipoDoc,
      numero_documento: numDoc,
      nombre: '',
      direccion: '',
      tipo_cliente: 'NATURAL',
      condicion_contribuyente: 'HABIDO',
    };
  }

  async findOne(boticaId: string, id: string) {
    const cliente = await this.prisma.clientes.findFirst({
      where: { id, deleted_at: null, botica_id: boticaId },
      include: {
        ventas: {
          where: { deleted_at: null },
          include: {
            detalles_ventas: {
              include: {
                productos_presentaciones: {
                  include: {
                    productos_comerciales: true,
                  },
                },
              },
            },
            pagos: {
              include: { metodos_pago: true },
            },
          },
          orderBy: { fecha: 'desc' },
          take: 20,
        },
      },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    const totalCompras = cliente.ventas.length;
    const montoTotalComprado = cliente.ventas.reduce(
      (acc, v) => acc + Number(v.total),
      0,
    );

    return {
      ...cliente,
      total_compras: totalCompras,
      monto_total_comprado: montoTotalComprado,
    };
  }

  async create(boticaId: string, dto: CreateClienteDto, usuarioId?: string) {
    this.logger.log(
      `Creando cliente: ${dto.nombre} (${dto.tipo_documento}: ${dto.numero_documento})`,
    );

    const existente = await this.prisma.clientes.findFirst({
      where: {
        tipo_documento: dto.tipo_documento,
        numero_documento: dto.numero_documento.trim(),
        deleted_at: null,
        botica_id: boticaId,
      },
    });

    if (existente) {
      throw new BadRequestException(
        `El cliente con ${dto.tipo_documento} ${dto.numero_documento} ya está registrado.`,
      );
    }

    return await this.prisma.clientes.create({
      data: {
        botica_id: boticaId,
        tipo_documento: dto.tipo_documento,
        numero_documento: dto.numero_documento.trim(),
        nombre: dto.nombre.trim(),
        direccion: dto.direccion?.trim() || null,
        telefono: dto.telefono?.trim() || null,
        email: dto.email?.trim() || null,
        tipo_cliente: dto.tipo_cliente || 'NATURAL',
        condicion_contribuyente: dto.condicion_contribuyente || 'HABIDO',
        estado_sunat: dto.estado_sunat || 'ACTIVO',
        estado: dto.estado || 'ACTIVO',
        limite_credito:
          dto.limite_credito !== undefined ? dto.limite_credito : 0,
        dias_credito: dto.dias_credito !== undefined ? dto.dias_credito : 0,
        saldo_actual: dto.saldo_actual !== undefined ? dto.saldo_actual : 0,
        estado_credito: dto.estado_credito || 'AL CORRIENTE',
        whatsapp: dto.whatsapp?.trim() || null,
        contacto_principal: dto.contacto_principal?.trim() || null,
        cargo_contacto: dto.cargo_contacto?.trim() || null,
        representante_legal: dto.representante_legal?.trim() || null,
        dni_representante: dto.dni_representante?.trim() || null,
        fecha_nacimiento: dto.fecha_nacimiento
          ? new Date(dto.fecha_nacimiento)
          : null,
        observaciones: dto.observaciones?.trim() || null,
        origen: dto.origen?.trim() || null,
        created_by: usuarioId,
      },
    });
  }

  async update(boticaId: string, id: string, dto: UpdateClienteDto, usuarioId?: string) {
    this.logger.log(`Actualizando cliente con ID: ${id}`);

    const cliente = await this.prisma.clientes.findFirst({
      where: { id, deleted_at: null, botica_id: boticaId },
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
          botica_id: boticaId,
        },
      });

      if (repetido) {
        throw new BadRequestException(
          `Ya existe otro cliente registrado con ${dto.tipo_documento} ${dto.numero_documento}.`,
        );
      }
    }

    const dataUpdate: any = {
      updated_by: usuarioId,
      updated_at: new Date(),
    };

    if (dto.tipo_documento) dataUpdate.tipo_documento = dto.tipo_documento;
    if (dto.numero_documento)
      dataUpdate.numero_documento = dto.numero_documento.trim();
    if (dto.nombre) dataUpdate.nombre = dto.nombre.trim();
    if (dto.direccion !== undefined)
      dataUpdate.direccion = dto.direccion?.trim() || null;
    if (dto.telefono !== undefined)
      dataUpdate.telefono = dto.telefono?.trim() || null;
    if (dto.email !== undefined) dataUpdate.email = dto.email?.trim() || null;
    if (dto.tipo_cliente !== undefined)
      dataUpdate.tipo_cliente = dto.tipo_cliente;
    if (dto.condicion_contribuyente !== undefined)
      dataUpdate.condicion_contribuyente = dto.condicion_contribuyente;
    if (dto.estado_sunat !== undefined)
      dataUpdate.estado_sunat = dto.estado_sunat;
    if (dto.estado !== undefined) dataUpdate.estado = dto.estado;
    if (dto.limite_credito !== undefined)
      dataUpdate.limite_credito = dto.limite_credito;
    if (dto.dias_credito !== undefined)
      dataUpdate.dias_credito = dto.dias_credito;
    if (dto.saldo_actual !== undefined)
      dataUpdate.saldo_actual = dto.saldo_actual;
    if (dto.estado_credito !== undefined)
      dataUpdate.estado_credito = dto.estado_credito;
    if (dto.whatsapp !== undefined)
      dataUpdate.whatsapp = dto.whatsapp?.trim() || null;
    if (dto.contacto_principal !== undefined)
      dataUpdate.contacto_principal = dto.contacto_principal?.trim() || null;
    if (dto.cargo_contacto !== undefined)
      dataUpdate.cargo_contacto = dto.cargo_contacto?.trim() || null;
    if (dto.representante_legal !== undefined)
      dataUpdate.representante_legal = dto.representante_legal?.trim() || null;
    if (dto.dni_representante !== undefined)
      dataUpdate.dni_representante = dto.dni_representante?.trim() || null;
    if (dto.fecha_nacimiento !== undefined)
      dataUpdate.fecha_nacimiento = dto.fecha_nacimiento
        ? new Date(dto.fecha_nacimiento)
        : null;
    if (dto.observaciones !== undefined)
      dataUpdate.observaciones = dto.observaciones?.trim() || null;
    if (dto.origen !== undefined)
      dataUpdate.origen = dto.origen?.trim() || null;

    return await this.prisma.clientes.update({
      where: { id },
      data: dataUpdate,
    });
  }

  async remove(boticaId: string, id: string, usuarioId?: string) {
    this.logger.log(`Eliminando cliente con ID: ${id}`);

    const cliente = await this.prisma.clientes.findFirst({
      where: { id, deleted_at: null, botica_id: boticaId },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    await this.prisma.clientes.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: usuarioId,
      },
    });

    return { mensaje: `Cliente "${cliente.nombre}" eliminado correctamente` };
  }
}
