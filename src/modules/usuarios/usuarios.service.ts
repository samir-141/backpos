import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(boticaId: string) {
    this.logger.log('Listando todos los usuarios de la botica');

    const usuarios = await this.prisma.usuarios.findMany({
      where: { deleted_at: null, botica_id: boticaId },
      orderBy: { created_at: 'desc' },
      include: {
        roles: true,
        boticas: { select: { nombre: true } },
        usuario_sucursales_usuario_sucursales_usuario_idTousuarios: {
          where: { activo: true },
          include: { sucursales: { select: { nombre: true } } },
        },
      },
    });

    return usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      correo: u.correo,
      estado: u.estado,
      rol_id: u.rol_id,
      rol_nombre: u.roles?.nombre || 'Sin Rol',
      botica_nombre: u.boticas?.nombre || 'Botica',
      sucursal_id:
        u.usuario_sucursales_usuario_sucursales_usuario_idTousuarios
          ?.sucursal_id || null,
      sucursal_nombre:
        u.usuario_sucursales_usuario_sucursales_usuario_idTousuarios?.sucursales
          ?.nombre || 'Sin asignar',
      created_at: u.created_at,
    }));
  }

  async findOne(boticaId: string, id: string) {
    const usuario = await this.prisma.usuarios.findFirst({
      where: { id, deleted_at: null, botica_id: boticaId },
      include: {
        roles: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      estado: usuario.estado,
      rol_id: usuario.rol_id,
      rol_nombre: usuario.roles?.nombre || 'Sin Rol',
      created_at: usuario.created_at,
    };
  }

  async create(boticaId: string, dto: CreateUsuarioDto) {
    this.logger.log(`Creando nuevo usuario: ${dto.correo}`);

    const existente = await this.prisma.usuarios.findFirst({
      where: {
        correo: dto.correo.trim().toLowerCase(),
        deleted_at: null,
        botica_id: boticaId,
      },
    });

    if (existente) {
      throw new BadRequestException(
        `El correo electrónico ${dto.correo} ya está registrado en el sistema.`,
      );
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    if (dto.sucursal_id) {
      const sucursal = await this.prisma.sucursales.findFirst({
        where: { id: dto.sucursal_id, botica_id: boticaId, deleted_at: null },
      });
      if (!sucursal)
        throw new BadRequestException(
          'La sucursal seleccionada no pertenece a esta botica.',
        );
    }

    const usuario = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.usuarios.create({
        data: {
          botica_id: boticaId,
          nombre: dto.nombre.trim(),
          correo: dto.correo.trim().toLowerCase(),
          password_hash,
          rol_id: dto.rol_id,
          estado: dto.estado || 'ACTIVO',
        },
      });
      if (dto.sucursal_id) {
        await tx.usuario_sucursales.create({
          data: {
            usuario_id: nuevo.id,
            botica_id: boticaId,
            sucursal_id: dto.sucursal_id,
            es_principal: true,
            activo: true,
          },
        });
      }
      return nuevo;
    });

    return {
      exito: true,
      mensaje: 'Usuario creado exitosamente',
      usuario_id: usuario.id,
    };
  }

  async update(boticaId: string, id: string, dto: UpdateUsuarioDto) {
    this.logger.log(`Actualizando usuario ID: ${id}`);

    const usuario = await this.prisma.usuarios.findFirst({
      where: { id, deleted_at: null, botica_id: boticaId },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (dto.correo) {
      const repetido = await this.prisma.usuarios.findFirst({
        where: {
          id: { not: id },
          correo: dto.correo.trim().toLowerCase(),
          deleted_at: null,
          botica_id: boticaId,
        },
      });
      if (repetido) {
        throw new BadRequestException(
          `El correo ${dto.correo} ya está en uso por otro usuario.`,
        );
      }
    }

    const updateData: any = {
      ...(dto.nombre ? { nombre: dto.nombre.trim() } : {}),
      ...(dto.correo ? { correo: dto.correo.trim().toLowerCase() } : {}),
      ...(dto.rol_id ? { rol_id: dto.rol_id } : {}),
      ...(dto.estado ? { estado: dto.estado } : {}),
      updated_at: new Date(),
    };

    if (dto.password && dto.password.trim() !== '') {
      updateData.password_hash = await bcrypt.hash(dto.password, 10);
    }

    await this.prisma.usuarios.update({
      where: { id },
      data: updateData,
    });

    if (dto.sucursal_id) {
      const sucursal = await this.prisma.sucursales.findFirst({
        where: { id: dto.sucursal_id, botica_id: boticaId, deleted_at: null },
      });
      if (!sucursal)
        throw new BadRequestException(
          'La sucursal seleccionada no pertenece a esta botica.',
        );
      await this.prisma.usuario_sucursales.updateMany({
        where: { usuario_id: id, activo: true },
        data: { activo: false, es_principal: false },
      });
      await this.prisma.usuario_sucursales.upsert({
        where: {
          usuario_id_sucursal_id: {
            usuario_id: id,
            sucursal_id: dto.sucursal_id,
          },
        },
        create: {
          usuario_id: id,
          botica_id: boticaId,
          sucursal_id: dto.sucursal_id,
          es_principal: true,
          activo: true,
        },
        update: { activo: true, es_principal: true },
      });
    }

    return { exito: true, mensaje: 'Usuario actualizado correctamente' };
  }

  async remove(boticaId: string, id: string) {
    this.logger.log(`Eliminando usuario ID: ${id}`);

    const usuario = await this.prisma.usuarios.findFirst({
      where: { id, deleted_at: null, botica_id: boticaId },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    await this.prisma.usuarios.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        estado: 'INACTIVO',
      },
    });

    return { mensaje: `Usuario "${usuario.nombre}" eliminado correctamente` };
  }

  async getRoles(boticaId: string) {
    const rolesBase = [
      'ADMINISTRADOR',
      'GERENTE',
      'FARMACÉUTICO',
      'CAJERO',
      'VENDEDOR',
      'ALMACENERO',
      'CONTADOR',
    ];
    const existentes = await this.prisma.roles.findMany({
      where: { botica_id: boticaId, deleted_at: null },
      select: { nombre: true },
    });
    const nombresExistentes = new Set(
      existentes.map((rol) => rol.nombre.toUpperCase()),
    );
    const faltantes = rolesBase.filter(
      (nombre) => !nombresExistentes.has(nombre),
    );
    if (faltantes.length > 0) {
      await this.prisma.roles.createMany({
        data: faltantes.map((nombre) => ({ botica_id: boticaId, nombre })),
        skipDuplicates: true,
      });
    }

    // --- SEED PERMISOS ---
    const permisosBase = [
      { codigo: 'ventas', descripcion: 'Ventas (POS)' },
      { codigo: 'inventario', descripcion: 'Inventario & Productos' },
      { codigo: 'clientes', descripcion: 'Clientes' },
      { codigo: 'reportes', descripcion: 'Reportes & Analítica' },
      { codigo: 'admin', descripcion: 'Administración & ERP' },
    ];
    const permisosExistentes = await this.prisma.permisos.findMany({
      where: { botica_id: boticaId, deleted_at: null },
      select: { codigo: true },
    });
    const codigosExistentes = new Set(permisosExistentes.map((p) => p.codigo));
    const permisosFaltantes = permisosBase.filter(
      (p) => !codigosExistentes.has(p.codigo),
    );
    if (permisosFaltantes.length > 0) {
      await this.prisma.permisos.createMany({
        data: permisosFaltantes.map((p) => ({
          botica_id: boticaId,
          codigo: p.codigo,
          descripcion: p.descripcion,
        })),
        skipDuplicates: true,
      });
    }

    const todosPermisos = await this.prisma.permisos.findMany({
      where: { botica_id: boticaId, deleted_at: null },
    });

    // --- SEED ROL PERMISOS ---
    const rolesConPermisos = await this.prisma.roles.findMany({
      where: { botica_id: boticaId, deleted_at: null },
      include: { rol_permisos: true },
    });

    for (const r of rolesConPermisos) {
      if (r.rol_permisos.length === 0) {
        const nombreUpper = r.nombre.toUpperCase();
        const esAdmin = nombreUpper === 'ADMINISTRADOR';
        const codigosAsignar = esAdmin
          ? ['ventas', 'inventario', 'clientes', 'reportes', 'admin']
          : ['ventas', 'inventario', 'clientes'];

        const permisosAAsignar = todosPermisos.filter((p) =>
          codigosAsignar.includes(p.codigo),
        );
        if (permisosAAsignar.length > 0) {
          await this.prisma.rol_permisos.createMany({
            data: permisosAAsignar.map((p) => ({
              rol_id: r.id,
              permiso_id: p.id,
              botica_id: boticaId,
            })),
          });
        }
      }
    }

    return await this.prisma.roles.findMany({
      where: { botica_id: boticaId, deleted_at: null },
      include: {
        rol_permisos: {
          include: { permisos: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async getSucursales(boticaId: string) {
    const sucursales = await this.prisma.sucursales.findMany({
      where: { deleted_at: null, botica_id: boticaId },
      include: {
        cajas: {
          where: { deleted_at: null },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return sucursales.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion,
      telefono: s.telefono || 'Sin teléfono',
      total_cajas: s.cajas.length,
      created_at: s.created_at,
    }));
  }

  async createSucursal(
    boticaId: string,
    dto: {
      nombre: string;
      direccion: string;
      telefono?: string;
    },
    usuarioId?: string,
  ) {
    this.logger.log(`Creando sucursal: ${dto.nombre}`);

    const sucursal = await this.prisma.sucursales.create({
      data: {
        botica_id: boticaId,
        nombre: dto.nombre.trim(),
        direccion: dto.direccion.trim(),
        telefono: dto.telefono?.trim() || null,
        created_by: usuarioId,
      },
    });

    // Crear caja por defecto
    await this.prisma.cajas.create({
      data: {
        sucursal_id: sucursal.id,
        botica_id: boticaId,
        nombre: `Caja Principal - ${sucursal.nombre}`,
        estado: 'ABIERTA',
        created_by: usuarioId,
      },
    });

    return {
      exito: true,
      mensaje: 'Sucursal registrada correctamente',
      sucursal_id: sucursal.id,
    };
  }

  async actualizarRolPermisos(
    boticaId: string,
    rolId: string,
    dto: { permisosIds: string[] },
  ) {
    this.logger.log(`Actualizando permisos para el rol ${rolId}`);

    const rol = await this.prisma.roles.findFirst({
      where: { id: rolId, botica_id: boticaId, deleted_at: null },
    });
    if (!rol) {
      throw new NotFoundException('Rol no encontrado');
    }

    // Delete current permissions
    await this.prisma.rol_permisos.deleteMany({
      where: { rol_id: rolId, botica_id: boticaId },
    });

    // Create new permissions
    if (dto.permisosIds && dto.permisosIds.length > 0) {
      const validPermisos = await this.prisma.permisos.findMany({
        where: {
          id: { in: dto.permisosIds },
          botica_id: boticaId,
          deleted_at: null,
        },
      });

      if (validPermisos.length > 0) {
        await this.prisma.rol_permisos.createMany({
          data: validPermisos.map((p) => ({
            rol_id: rolId,
            permiso_id: p.id,
            botica_id: boticaId,
          })),
        });
      }
    }

    return { mensaje: 'Permisos actualizados correctamente' };
  }

  async createRol(boticaId: string, nombre: string, userId: string) {
    const nombreTrimmed = nombre?.trim();
    if (!nombreTrimmed) {
      throw new BadRequestException('El nombre del rol es requerido');
    }

    const existing = await this.prisma.roles.findFirst({
      where: {
        botica_id: boticaId,
        nombre: { equals: nombreTrimmed, mode: 'insensitive' },
        deleted_at: null,
      },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un rol con ese nombre');
    }

    return this.prisma.roles.create({
      data: {
        botica_id: boticaId,
        nombre: nombreTrimmed,
        created_by: userId,
      },
    });
  }

  async updateRol(boticaId: string, id: string, nombre: string, userId: string) {
    const nombreTrimmed = nombre?.trim();
    if (!nombreTrimmed) {
      throw new BadRequestException('El nombre del rol es requerido');
    }

    const rol = await this.prisma.roles.findFirst({
      where: { id, botica_id: boticaId, deleted_at: null },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (rol.nombre.toUpperCase() === 'ADMINISTRADOR') {
      throw new BadRequestException('No se puede modificar el rol ADMINISTRADOR');
    }

    const existing = await this.prisma.roles.findFirst({
      where: {
        botica_id: boticaId,
        nombre: { equals: nombreTrimmed, mode: 'insensitive' },
        id: { not: id },
        deleted_at: null,
      },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un rol con ese nombre');
    }

    return this.prisma.roles.update({
      where: { id },
      data: {
        nombre: nombreTrimmed,
        updated_by: userId,
        updated_at: new Date(),
      },
    });
  }

  async deleteRol(boticaId: string, id: string, userId: string) {
    const rol = await this.prisma.roles.findFirst({
      where: { id, botica_id: boticaId, deleted_at: null },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (rol.nombre.toUpperCase() === 'ADMINISTRADOR') {
      throw new BadRequestException('No se puede eliminar el rol ADMINISTRADOR');
    }

    const usersWithRole = await this.prisma.usuarios.findFirst({
      where: { rol_id: id, botica_id: boticaId, deleted_at: null },
    });

    if (usersWithRole) {
      throw new BadRequestException(
        'No se puede eliminar el rol porque está asignado a usuarios activos',
      );
    }

    return this.prisma.roles.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: userId,
      },
    });
  }
}
