import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdministracionGeneralService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumen() {
    const [boticasTotal, boticasActivas, sucursales, colaboradores] = await Promise.all([
      this.prisma.boticas.count({ where: { deleted_at: null } }),
      this.prisma.boticas.count({ where: { deleted_at: null, estado: 'ACTIVO' } }),
      this.prisma.sucursales.count({ where: { deleted_at: null } }),
      this.prisma.usuarios.count({ where: { deleted_at: null } }),
    ]);

    const boticasList = await this.prisma.boticas.findMany({
      where: { deleted_at: null },
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
    });

    const boticas = await Promise.all(
      boticasList.map(async (b) => {
        const [colabCount, prodCount, ventasCount, gastosCount] = await Promise.all([
          this.prisma.usuarios.count({ where: { botica_id: b.id, deleted_at: null } }),
          this.prisma.productos_comerciales.count({ where: { botica_id: b.id, deleted_at: null } }),
          this.prisma.ventas.count({ where: { botica_id: b.id, deleted_at: null } }),
          this.prisma.gastos_operativos.count({ where: { botica_id: b.id, deleted_at: null } }),
        ]);

        return {
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
            colaboradores: colabCount,
            productos: prodCount,
            ventas: ventasCount,
            gastos: gastosCount,
          },
        };
      }),
    );

    return {
      resumen: {
        boticas: boticasTotal,
        boticas_activas: boticasActivas,
        sucursales,
        colaboradores,
      },
      boticas,
    };
  }

  async getColaboradores(boticaId: string) {
    const usuarios = await this.prisma.usuarios.findMany({
      where: { botica_id: boticaId, deleted_at: null },
      include: { roles: true },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      usuarios.map(async (u) => {
        const sucursalesRel = await this.prisma.usuario_sucursales.findMany({
          where: { usuario_id: u.id, activo: true },
          include: { sucursales: true },
        });

        const ventasRegistradas = await this.prisma.ventas.count({
          where: { created_by: u.id, deleted_at: null },
        });

        return {
          id: u.id,
          nombre: u.nombre,
          correo: u.correo,
          estado: u.estado,
          es_super_admin: String(u.roles?.nombre || '').toUpperCase() === 'ADMINISTRADOR',
          rol: u.roles?.nombre || 'SIN_ROL',
          created_at: u.created_at,
          ventas_registradas: ventasRegistradas,
          sucursales: sucursalesRel.map((sr) => ({
            id: sr.sucursal_id,
            nombre: sr.sucursales.nombre,
            es_principal: Boolean(sr.es_principal),
          })),
        };
      }),
    );
  }

  async getRoles(boticaId: string) {
    return this.prisma.roles.findMany({
      where: { botica_id: boticaId, deleted_at: null },
      select: { id: true, nombre: true },
    });
  }

  async crearBotica(body: any) {
    return this.prisma.$transaction(async (tx) => {
      // Validar RUC único
      const existeRuc = await tx.boticas.findFirst({
        where: { ruc: body.ruc, deleted_at: null },
      });
      if (existeRuc) {
        throw new BadRequestException('El RUC ingresado ya pertenece a una botica registrada.');
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
        data: { botica_id: botica.id, nombre: 'EFECTIVO', requiere_referencia: false },
      });

      // 7. Crear usuario responsable si se especifica
      if (body.responsable_nombre && body.responsable_correo && body.responsable_password) {
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

  async actualizarBotica(boticaId: string, body: any) {
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

  async crearSucursal(boticaId: string, body: any) {
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

  async actualizarSucursal(sucursalId: string, body: any) {
    return this.prisma.sucursales.update({
      where: { id: sucursalId },
      data: {
        nombre: body.nombre,
        direccion: body.direccion,
        telefono: body.telefono,
      },
    });
  }

  async archivarSucursal(sucursalId: string) {
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

  async crearColaborador(boticaId: string, body: any) {
    return this.prisma.$transaction(async (tx) => {
      const existeCorreo = await tx.usuarios.findFirst({
        where: { correo: body.correo, deleted_at: null },
      });
      if (existeCorreo) {
        throw new BadRequestException('El correo electrónico ya está registrado.');
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

      if (body.sucursal_id) {
        await tx.usuario_sucursales.create({
          data: {
            usuario_id: usuario.id,
            botica_id: boticaId,
            sucursal_id: body.sucursal_id,
            es_principal: true,
            activo: true,
          },
        });
      }

      return usuario;
    });
  }

  async actualizarColaborador(boticaId: string, usuarioId: string, body: any) {
    return this.prisma.$transaction(async (tx) => {
      const existeCorreo = await tx.usuarios.findFirst({
        where: { correo: body.correo, id: { not: usuarioId }, deleted_at: null },
      });
      if (existeCorreo) {
        throw new BadRequestException('El correo electrónico ya está en uso por otro colaborador.');
      }

      const updateData: any = {
        nombre: body.nombre,
        correo: body.correo,
        rol_id: body.rol_id,
        estado: body.estado,
      };

      if (body.password) {
        updateData.password_hash = await bcrypt.hash(body.password, 12);
      }

      const usuario = await tx.usuarios.update({
        where: { id: usuarioId },
        data: updateData,
      });

      if (body.sucursal_id) {
        // Desactivar anteriores sucursales
        await tx.usuario_sucursales.updateMany({
          where: { usuario_id: usuarioId, activo: true },
          data: { activo: false, es_principal: false },
        });

        // Buscar relación existente para reactivarla
        const existeRelacion = await tx.usuario_sucursales.findFirst({
          where: { usuario_id: usuarioId, sucursal_id: body.sucursal_id },
        });

        if (existeRelacion) {
          await tx.usuario_sucursales.update({
            where: {
              usuario_id_sucursal_id: {
                usuario_id: usuarioId,
                sucursal_id: body.sucursal_id,
              },
            },
            data: { activo: true, es_principal: true },
          });
        } else {
          await tx.usuario_sucursales.create({
            data: {
              usuario_id: usuarioId,
              botica_id: boticaId,
              sucursal_id: body.sucursal_id,
              es_principal: true,
              activo: true,
            },
          });
        }
      }

      return usuario;
    });
  }

  async archivarColaborador(usuarioId: string) {
    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.usuarios.update({
        where: { id: usuarioId },
        data: { deleted_at: ahora, estado: 'INACTIVO' },
      });
      await tx.usuario_sucursales.updateMany({
        where: { usuario_id: usuarioId, activo: true },
        data: { activo: false, es_principal: false },
      });
    });
  }

  async estadoBotica(boticaId: string, estado: string) {
    return this.prisma.boticas.update({
      where: { id: boticaId },
      data: { estado },
    });
  }
}
