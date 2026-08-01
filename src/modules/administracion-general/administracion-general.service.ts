import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import {
  CreateBoticaDto,
  CreateColaboradorDto,
  CreateSucursalDto,
  UpdateBoticaDto,
  UpdateColaboradorDto,
  UpdateSucursalDto,
  PaginationQueryDto,
} from './dto/administracion-general.dto';

@Injectable()
export class AdministracionGeneralService {
  constructor(private readonly prisma: PrismaService) {}

  private async validarBotica(boticaId: string) {
    const botica = await this.prisma.boticas.findFirst({
      where: { id: boticaId, deleted_at: null },
      select: { id: true },
    });
    if (!botica) throw new NotFoundException('La botica no existe.');
  }

  private async validarSucursal(boticaId: string, sucursalId: string) {
    const sucursal = await this.prisma.sucursales.findFirst({
      where: { id: sucursalId, botica_id: boticaId, deleted_at: null },
      select: { id: true },
    });
    if (!sucursal) {
      throw new NotFoundException(
        'La sucursal no pertenece a la botica indicada.',
      );
    }
  }

  private async validarSucursales(
    client: PrismaService | Prisma.TransactionClient,
    boticaId: string,
    sucursalIds: string[],
  ) {
    const ids = [...new Set(sucursalIds)];
    if (ids.length === 0) {
      throw new BadRequestException('Debe asignar al menos una sucursal.');
    }
    const sucursales = await client.sucursales.findMany({
      where: {
        id: { in: ids },
        botica_id: boticaId,
        deleted_at: null,
      },
      select: { id: true },
    });
    if (sucursales.length !== ids.length) {
      throw new BadRequestException(
        'Una o más sucursales no pertenecen a la botica indicada.',
      );
    }
    return ids;
  }

  private async validarRol(boticaId: string, rolId: string) {
    const rol = await this.prisma.roles.findFirst({
      where: { id: rolId, botica_id: boticaId, deleted_at: null },
      select: { id: true },
    });
    if (!rol)
      throw new BadRequestException(
        'El rol no pertenece a la botica indicada.',
      );
  }

  private async validarColaborador(boticaId: string, usuarioId: string) {
    const usuario = await this.prisma.usuarios.findFirst({
      where: { id: usuarioId, botica_id: boticaId, deleted_at: null },
      select: { id: true },
    });
    if (!usuario) {
      throw new NotFoundException(
        'El colaborador no pertenece a la botica indicada.',
      );
    }
  }

  async getResumen(query: PaginationQueryDto = new PaginationQueryDto()) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const buscar = query.buscar?.trim() ?? '';
    const whereBotica: Prisma.boticasWhereInput = {
      deleted_at: null,
      ...(buscar
        ? {
            OR: [
              { nombre: { contains: buscar, mode: 'insensitive' } },
              { razon_social: { contains: buscar, mode: 'insensitive' } },
              { ruc: { contains: buscar } },
            ],
          }
        : {}),
    };
    const [boticasTotal, boticasActivas, sucursales, colaboradores] =
      await Promise.all([
        this.prisma.boticas.count({ where: { deleted_at: null } }),
        this.prisma.boticas.count({
          where: { deleted_at: null, estado: 'ACTIVO' },
        }),
        this.prisma.sucursales.count({ where: { deleted_at: null } }),
        this.prisma.usuarios.count({ where: { deleted_at: null } }),
      ]);

    const [boticasFiltradas, boticasList] = await Promise.all([
      this.prisma.boticas.count({ where: whereBotica }),
      this.prisma.boticas.findMany({
        where: whereBotica,
        include: {
          sucursales: {
            where: { deleted_at: null },
            include: {
              cajas: {
                where: { deleted_at: null },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const boticaIds = boticasList.map((botica) => botica.id);
    const aggregate = async (delegate: {
      groupBy: (
        args: object,
      ) => Promise<Array<{ botica_id: string; _count: { _all: number } }>>;
    }) =>
      boticaIds.length
        ? delegate.groupBy({
            by: ['botica_id'],
            where: { botica_id: { in: boticaIds }, deleted_at: null },
            _count: { _all: true },
          })
        : [];
    const [colabCounts, prodCounts, ventasCounts, gastosCounts] =
      await Promise.all([
        aggregate(this.prisma.usuarios),
        aggregate(this.prisma.productos_comerciales),
        aggregate(this.prisma.ventas),
        aggregate(this.prisma.gastos_operativos),
      ]);
    const toMap = (
      rows: Array<{ botica_id: string; _count: { _all: number } }>,
    ) => new Map(rows.map((row) => [row.botica_id, row._count._all]));
    const colabMap = toMap(colabCounts);
    const prodMap = toMap(prodCounts);
    const ventasMap = toMap(ventasCounts);
    const gastosMap = toMap(gastosCounts);
    const boticas = boticasList.map((b) => ({
      id: b.id,
      nombre: b.nombre,
      razon_social: b.razon_social,
      ruc: b.ruc,
      direccion: b.direccion,
      telefono: b.telefono,
      email: b.email,
      estado: b.estado,
      created_at: b.created_at,
      sucursales: b.sucursales.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        direccion: s.direccion,
        telefono: s.telefono,
        total_cajas: s.cajas.length,
      })),
      indicadores: {
        colaboradores: colabMap.get(b.id) ?? 0,
        productos: prodMap.get(b.id) ?? 0,
        ventas: ventasMap.get(b.id) ?? 0,
        gastos: gastosMap.get(b.id) ?? 0,
      },
    }));

    return {
      resumen: {
        boticas: boticasTotal,
        boticas_activas: boticasActivas,
        sucursales,
        colaboradores,
      },
      boticas,
      meta: {
        page,
        limit,
        total: boticasFiltradas,
        totalPages: Math.max(1, Math.ceil(boticasFiltradas / limit)),
      },
    };
  }

  async getColaboradores(
    boticaId: string,
    query: PaginationQueryDto = new PaginationQueryDto(),
  ) {
    await this.validarBotica(boticaId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const buscar = query.buscar?.trim() ?? '';
    const where: Prisma.usuariosWhereInput = {
      botica_id: boticaId,
      deleted_at: null,
      ...(buscar
        ? {
            OR: [
              { nombre: { contains: buscar, mode: 'insensitive' } },
              { correo: { contains: buscar, mode: 'insensitive' } },
              { roles: { nombre: { contains: buscar, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, usuarios] = await Promise.all([
      this.prisma.usuarios.count({ where }),
      this.prisma.usuarios.findMany({
        where,
        include: { roles: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const usuarioIds = usuarios.map((usuario) => usuario.id);
    const [sucursalesRel, ventasAgrupadas] = usuarioIds.length
      ? await Promise.all([
          this.prisma.usuario_sucursales.findMany({
            where: {
              usuario_id: { in: usuarioIds },
              botica_id: boticaId,
              activo: true,
            },
            include: { sucursales: true },
          }),
          this.prisma.ventas.groupBy({
            by: ['created_by'],
            where: {
              created_by: { in: usuarioIds },
              botica_id: boticaId,
              deleted_at: null,
            },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const sucursalesPorUsuario = new Map<string, typeof sucursalesRel>();
    for (const relacion of sucursalesRel) {
      const actuales = sucursalesPorUsuario.get(relacion.usuario_id) ?? [];
      actuales.push(relacion);
      sucursalesPorUsuario.set(relacion.usuario_id, actuales);
    }
    const ventasPorUsuario = new Map(
      ventasAgrupadas.map((row) => [row.created_by, row._count._all]),
    );
    const data = usuarios.map((u) => {
      const relaciones = sucursalesPorUsuario.get(u.id) ?? [];
      return {
        id: u.id,
        nombre: u.nombre,
        correo: u.correo,
        estado: u.estado,
        es_super_admin: u.es_super_admin,
        rol: u.roles?.nombre || 'SIN_ROL',
        created_at: u.created_at,
        ventas_registradas: ventasPorUsuario.get(u.id) ?? 0,
        sucursales: relaciones.map((sr) => ({
          id: sr.sucursal_id,
          nombre: sr.sucursales.nombre,
          es_principal: Boolean(sr.es_principal),
        })),
      };
    });
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getRoles(boticaId: string) {
    await this.validarBotica(boticaId);
    return this.prisma.roles.findMany({
      where: { botica_id: boticaId, deleted_at: null },
      select: { id: true, nombre: true },
    });
  }

  async crearBotica(body: CreateBoticaDto) {
    return this.prisma.$transaction(async (tx) => {
      // Validar RUC único
      const existeRuc = await tx.boticas.findFirst({
        where: { ruc: body.ruc, deleted_at: null },
      });
      if (existeRuc) {
        throw new BadRequestException(
          'El RUC ingresado ya pertenece a una botica registrada.',
        );
      }

      // 1. Crear botica
      const botica = await tx.boticas.create({
        data: {
          nombre: body.nombre,
          razon_social: body.razon_social,
          ruc: body.ruc,
          direccion: body.direccion,
          telefono: body.telefono,
          email: body.email,
          estado: 'ACTIVO',
        },
      });

      // 2. Crear sucursal
      const sucursal = await tx.sucursales.create({
        data: {
          botica_id: botica.id,
          nombre: body.sucursal_nombre,
          direccion: body.sucursal_direccion || 'Dirección de Sucursal',
          telefono: body.sucursal_telefono,
        },
      });

      // 3. Crear roles por defecto
      const adminRol = await tx.roles.create({
        data: { botica_id: botica.id, nombre: 'ADMINISTRADOR' },
      });
      await tx.roles.create({
        data: { botica_id: botica.id, nombre: 'CAJERO' },
      });
      await tx.roles.create({
        data: { botica_id: botica.id, nombre: 'VENDEDOR' },
      });

      // 4. Crear caja por defecto
      await tx.cajas.create({
        data: {
          botica_id: botica.id,
          sucursal_id: sucursal.id,
          nombre: `Caja Principal - ${body.sucursal_nombre}`,
          estado: 'CERRADA',
        },
      });

      // 5. Crear series por defecto
      await tx.series_documentos.create({
        data: {
          botica_id: botica.id,
          sucursal_id: sucursal.id,
          tipo_documento: 'BOLETA',
          serie: 'B001',
          correlativo_inicial: 1,
          correlativo_actual: 1,
          longitud_correlativo: 8,
          activo: true,
        },
      });
      await tx.series_documentos.create({
        data: {
          botica_id: botica.id,
          sucursal_id: sucursal.id,
          tipo_documento: 'FACTURA',
          serie: 'F001',
          correlativo_inicial: 1,
          correlativo_actual: 1,
          longitud_correlativo: 8,
          activo: true,
        },
      });

      // 6. Crear método de pago por defecto
      await tx.metodos_pago.create({
        data: {
          botica_id: botica.id,
          nombre: 'EFECTIVO',
          requiere_referencia: false,
        },
      });

      // 6.5. Crear tipos de movimiento de inventario por defecto
      const codigoTipoIngreso = `INGRESO_${botica.id.replace(/-/g, '').slice(0, 12)}`;
      await tx.tipos_movimientos_inventario.createMany({
        data: [
          {
            botica_id: botica.id,
            codigo: 'VENTA',
            descripcion: 'Salida por venta de productos',
            afecta_stock: -1,
          },
          {
            botica_id: botica.id,
            codigo: 'COMPRA',
            descripcion: 'Ingreso por compra de mercadería',
            afecta_stock: 1,
          },
          {
            botica_id: botica.id,
            codigo: codigoTipoIngreso,
            descripcion: 'Ingreso manual de lote',
            afecta_stock: 1,
          },
        ],
      });

      // 7. Crear usuario responsable si se especifica
      if (
        body.responsable_nombre &&
        body.responsable_correo &&
        body.responsable_password
      ) {
        const hash = await bcrypt.hash(body.responsable_password, 12);
        const usuario = await tx.usuarios.create({
          data: {
            botica_id: botica.id,
            rol_id: adminRol.id,
            nombre: body.responsable_nombre,
            correo: body.responsable_correo,
            password_hash: hash,
            estado: 'ACTIVO',
          },
        });

        await tx.usuario_sucursales.create({
          data: {
            usuario_id: usuario.id,
            botica_id: botica.id,
            sucursal_id: sucursal.id,
            es_principal: true,
            activo: true,
          },
        });
      }

      return botica;
    });
  }

  async actualizarBotica(boticaId: string, body: UpdateBoticaDto) {
    const existe = await this.prisma.boticas.findFirst({
      where: { id: boticaId, deleted_at: null },
    });
    if (!existe) throw new NotFoundException('La botica no existe.');

    return this.prisma.boticas.update({
      where: { id: boticaId },
      data: {
        nombre: body.nombre,
        razon_social: body.razon_social,
        ruc: body.ruc,
        direccion: body.direccion,
        telefono: body.telefono,
        email: body.email,
        estado: body.estado,
      },
    });
  }

  async archivarBotica(boticaId: string) {
    const existe = await this.prisma.boticas.findFirst({
      where: { id: boticaId, deleted_at: null },
    });
    if (!existe) throw new NotFoundException('La botica no existe.');

    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      // Inactivar botica
      await tx.boticas.update({
        where: { id: boticaId },
        data: { deleted_at: ahora, estado: 'INACTIVO' },
      });
      // Inactivar usuarios de la botica
      await tx.usuarios.updateMany({
        where: { botica_id: boticaId, deleted_at: null },
        data: { deleted_at: ahora, estado: 'INACTIVO' },
      });
      // Inactivar sucursales
      await tx.sucursales.updateMany({
        where: { botica_id: boticaId, deleted_at: null },
        data: { deleted_at: ahora },
      });
    });
  }

  async crearSucursal(boticaId: string, body: CreateSucursalDto) {
    await this.validarBotica(boticaId);
    return this.prisma.$transaction(async (tx) => {
      const sucursal = await tx.sucursales.create({
        data: {
          botica_id: boticaId,
          nombre: body.nombre,
          direccion: body.direccion,
          telefono: body.telefono,
        },
      });

      // Crear caja por defecto
      await tx.cajas.create({
        data: {
          botica_id: boticaId,
          sucursal_id: sucursal.id,
          nombre: `Caja Principal - ${body.nombre}`,
          estado: 'CERRADA',
        },
      });

      // Crear series por defecto
      await tx.series_documentos.create({
        data: {
          botica_id: boticaId,
          sucursal_id: sucursal.id,
          tipo_documento: 'BOLETA',
          serie: 'B001',
          correlativo_inicial: 1,
          correlativo_actual: 1,
          longitud_correlativo: 8,
          activo: true,
        },
      });
      await tx.series_documentos.create({
        data: {
          botica_id: boticaId,
          sucursal_id: sucursal.id,
          tipo_documento: 'FACTURA',
          serie: 'F001',
          correlativo_inicial: 1,
          correlativo_actual: 1,
          longitud_correlativo: 8,
          activo: true,
        },
      });

      return sucursal;
    });
  }

  async actualizarSucursal(
    boticaId: string,
    sucursalId: string,
    body: UpdateSucursalDto,
  ) {
    await this.validarSucursal(boticaId, sucursalId);
    return this.prisma.sucursales.update({
      where: { id: sucursalId },
      data: {
        nombre: body.nombre,
        direccion: body.direccion,
        telefono: body.telefono,
      },
    });
  }

  async archivarSucursal(boticaId: string, sucursalId: string) {
    await this.validarSucursal(boticaId, sucursalId);
    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.sucursales.update({
        where: { id: sucursalId },
        data: { deleted_at: ahora },
      });
      // Desactivar relaciones de usuario
      await tx.usuario_sucursales.updateMany({
        where: { sucursal_id: sucursalId, activo: true },
        data: { activo: false, es_principal: false },
      });
    });
  }

  async crearColaborador(boticaId: string, body: CreateColaboradorDto) {
    await this.validarBotica(boticaId);
    await this.validarRol(boticaId, body.rol_id);
    return this.prisma.$transaction(async (tx) => {
      const sucursalIds = await this.validarSucursales(
        tx,
        boticaId,
        body.sucursal_ids,
      );
      const existeCorreo = await tx.usuarios.findFirst({
        where: { correo: body.correo, deleted_at: null },
      });
      if (existeCorreo) {
        throw new BadRequestException(
          'El correo electrónico ya está registrado.',
        );
      }

      const hash = await bcrypt.hash(body.password, 12);
      const usuario = await tx.usuarios.create({
        data: {
          botica_id: boticaId,
          rol_id: body.rol_id,
          nombre: body.nombre,
          correo: body.correo,
          password_hash: hash,
          estado: body.estado || 'ACTIVO',
        },
      });

      await Promise.all(
        sucursalIds.map((sucursalId, index) =>
          tx.usuario_sucursales.create({
            data: {
              usuario_id: usuario.id,
              botica_id: boticaId,
              sucursal_id: sucursalId,
              es_principal: index === 0,
              activo: true,
            },
          }),
        ),
      );

      return usuario;
    });
  }

  async actualizarColaborador(
    boticaId: string,
    usuarioId: string,
    body: UpdateColaboradorDto,
  ) {
    await this.validarColaborador(boticaId, usuarioId);
    if (body.rol_id) await this.validarRol(boticaId, body.rol_id);
    return this.prisma.$transaction(async (tx) => {
      const sucursalIds = body.sucursal_ids
        ? await this.validarSucursales(tx, boticaId, body.sucursal_ids)
        : undefined;
      const existeCorreo = body.correo
        ? await tx.usuarios.findFirst({
            where: {
              correo: body.correo,
              id: { not: usuarioId },
              deleted_at: null,
            },
          })
        : null;
      if (existeCorreo) {
        throw new BadRequestException(
          'El correo electrónico ya está en uso por otro colaborador.',
        );
      }

      const updateData: {
        nombre?: string;
        correo?: string;
        rol_id?: string;
        estado?: string;
        password_hash?: string;
      } = {};
      if (body.nombre !== undefined) updateData.nombre = body.nombre;
      if (body.correo !== undefined) updateData.correo = body.correo;
      if (body.rol_id !== undefined) updateData.rol_id = body.rol_id;
      if (body.estado !== undefined) updateData.estado = body.estado;

      if (body.password) {
        updateData.password_hash = await bcrypt.hash(body.password, 12);
      }

      const usuario = await tx.usuarios.update({
        where: { id: usuarioId },
        data: updateData,
      });

      if (sucursalIds !== undefined) {
        const relaciones = await tx.usuario_sucursales.findMany({
          where: { usuario_id: usuarioId, botica_id: boticaId },
          select: { sucursal_id: true, activo: true, es_principal: true },
        });
        const seleccionadas = new Set(sucursalIds);
        const principalActual = relaciones.find(
          (relacion) =>
            relacion.activo &&
            relacion.es_principal &&
            seleccionadas.has(relacion.sucursal_id),
        )?.sucursal_id;
        const principalId = principalActual ?? sucursalIds[0];

        const aDesactivar = relaciones.filter(
          (relacion) =>
            relacion.activo && !seleccionadas.has(relacion.sucursal_id),
        );
        await Promise.all(
          aDesactivar.map((relacion) =>
            tx.usuario_sucursales.update({
              where: {
                usuario_id_sucursal_id: {
                  usuario_id: usuarioId,
                  sucursal_id: relacion.sucursal_id,
                },
              },
              data: { activo: false, es_principal: false },
            }),
          ),
        );

        const existentes = new Map(
          relaciones.map((relacion) => [relacion.sucursal_id, relacion]),
        );
        await Promise.all(
          sucursalIds.map((sucursalId) => {
            const relacion = existentes.get(sucursalId);
            const esPrincipal = sucursalId === principalId;
            if (relacion) {
              if (
                relacion.activo === true &&
                Boolean(relacion.es_principal) === esPrincipal
              ) {
                return Promise.resolve();
              }
              return tx.usuario_sucursales.update({
                where: {
                  usuario_id_sucursal_id: {
                    usuario_id: usuarioId,
                    sucursal_id: sucursalId,
                  },
                },
                data: { activo: true, es_principal: esPrincipal },
              });
            }
            return tx.usuario_sucursales.create({
              data: {
                usuario_id: usuarioId,
                botica_id: boticaId,
                sucursal_id: sucursalId,
                es_principal: esPrincipal,
                activo: true,
              },
            });
          }),
        );
      }

      return usuario;
    });
  }

  async archivarColaborador(boticaId: string, usuarioId: string) {
    await this.validarColaborador(boticaId, usuarioId);
    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.usuarios.update({
        where: { id: usuarioId },
        data: { deleted_at: ahora, estado: 'INACTIVO' },
      });
      await tx.usuario_sucursales.updateMany({
        where: { usuario_id: usuarioId, botica_id: boticaId, activo: true },
        data: { activo: false, es_principal: false },
      });
    });
  }

  async estadoBotica(boticaId: string, estado: string) {
    await this.validarBotica(boticaId);
    return this.prisma.boticas.update({
      where: { id: boticaId },
      data: { estado },
    });
  }
}
