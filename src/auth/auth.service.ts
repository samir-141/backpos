// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(correo: string, password: string) {
    const usuario = await this.prisma.usuarios.findFirst({
      where: {
        correo,
        deleted_at: null,
        estado: 'ACTIVO',
      },
      include: {
        roles: true,
      },
    });
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValid = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return usuario;
  }

  async login(usuario: any) {
    const rolNombre = usuario.roles?.nombre || '';
    const rolUpper = String(rolNombre).toUpperCase();
    const esAdminBotica = ['ADMINISTRADOR', 'PROPIETARIO', 'GERENTE'].includes(
      rolUpper,
    );
    const esSuperAdmin = usuario.es_super_admin === true;

    // Obtener sucursales asignadas al usuario
    const sucursalesUsuario = await this.prisma.usuario_sucursales.findMany({
      where: {
        usuario_id: usuario.id,
        botica_id: usuario.botica_id,
        activo: true,
      },
      include: {
        sucursales: {
          include: {
            boticas: true,
          },
        },
      },
    });

    if (sucursalesUsuario.length === 0 && !esAdminBotica && !esSuperAdmin) {
      throw new UnauthorizedException('Usuario sin sucursales asignadas');
    }

    let sucursalesDisponibles: any[] = [];
    if (esAdminBotica || esSuperAdmin) {
      const todasSucursales = await this.prisma.sucursales.findMany({
        where: { botica_id: usuario.botica_id, deleted_at: null },
        include: { boticas: true },
        orderBy: { nombre: 'asc' },
      });
      sucursalesDisponibles = todasSucursales.map((s) => {
        const asig = sucursalesUsuario.find((u) => u.sucursal_id === s.id);
        return {
          id: s.id,
          nombre: s.nombre,
          empresa: s.boticas?.razon_social || 'FarmaPOS',
          botica_id: s.boticas?.id,
          es_principal: asig ? Boolean(asig.es_principal) : false,
          botica_ruc: s.boticas?.ruc || null,
          botica_direccion: s.boticas?.direccion || null,
          botica_telefono: s.boticas?.telefono || null,
        };
      });
    } else {
      sucursalesDisponibles = sucursalesUsuario.map((s) => ({
        id: s.sucursal_id,
        nombre: s.sucursales.nombre,
        empresa: s.sucursales.boticas?.razon_social || 'FarmaPOS',
        botica_id: s.sucursales.boticas?.id,
        es_principal: Boolean(s.es_principal),
        botica_ruc: s.sucursales.boticas?.ruc || null,
        botica_direccion: s.sucursales.boticas?.direccion || null,
        botica_telefono: s.sucursales.boticas?.telefono || null,
      }));
    }

    const principalAsignada = sucursalesUsuario.find((s) => s.es_principal);
    const sucursalActual =
      sucursalesDisponibles.find(
        (s) => s.id === principalAsignada?.sucursal_id,
      ) || sucursalesDisponibles[0];

    const sucursalActualId = sucursalActual?.id;
    const sucursalActualNombre = sucursalActual?.nombre || 'Sucursal Principal';
    const sucursalActualEmpresa = sucursalActual?.empresa || 'FarmaPOS';

    // Generar JWT
    const payload = {
      sub: usuario.id,
      correo: usuario.correo,
      nombre: usuario.nombre,
      rol: usuario.roles?.nombre || 'SIN_ROL',
      botica_id: usuario.botica_id,
      sucursal_id: sucursalActualId,
      es_super_admin: esSuperAdmin,
    };

    return {
      token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.roles?.nombre || 'SIN_ROL',
        es_super_admin: esSuperAdmin,
      },
      sucursal_actual: {
        id: sucursalActualId,
        nombre: sucursalActualNombre,
        empresa: sucursalActualEmpresa,
        es_principal: true,
      },
      sucursales_disponibles: sucursalesDisponibles,
    };
  }
}
