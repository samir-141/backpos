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
    const esAdmin =
      rolUpper.includes('ADMIN') ||
      rolUpper.includes('PROPIETARIO') ||
      rolUpper === 'GERENTE';

    // Obtener sucursales asignadas al usuario
    const sucursalesUsuario = await this.prisma.usuario_sucursales.findMany({
      where: {
        usuario_id: usuario.id,
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

    if (sucursalesUsuario.length === 0 && !esAdmin) {
      throw new UnauthorizedException('Usuario sin sucursales asignadas');
    }

    let sucursalesDisponibles: any[] = [];
    if (esAdmin) {
      const todasSucursales = await this.prisma.sucursales.findMany({
        where: { deleted_at: null },
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
        };
      });
    } else {
      sucursalesDisponibles = sucursalesUsuario.map((s) => ({
        id: s.sucursal_id,
        nombre: s.sucursales.nombre,
        empresa: s.sucursales.boticas?.razon_social || 'FarmaPOS',
        botica_id: s.sucursales.boticas?.id,
        es_principal: Boolean(s.es_principal),
      }));
    }

    const principal =
      sucursalesUsuario.find((s) => s.es_principal) ||
      (sucursalesDisponibles.length > 0
        ? {
            sucursal_id: sucursalesDisponibles[0].id,
            sucursales: {
              nombre: sucursalesDisponibles[0].nombre,
              boticas: { id: sucursalesDisponibles[0].botica_id },
            },
          }
        : null);

    const sucursalActualId =
      principal?.sucursal_id || sucursalesDisponibles[0]?.id;
    const sucursalActualNombre =
      principal?.sucursales?.nombre ||
      sucursalesDisponibles[0]?.nombre ||
      'Sucursal Principal';
    const sucursalActualEmpresa =
      principal?.sucursales?.boticas?.razon_social ||
      sucursalesDisponibles[0]?.empresa ||
      'FarmaPOS';
    const sucursalActualBoticaId =
      principal?.sucursales?.boticas?.id ||
      sucursalesDisponibles[0]?.botica_id;

    // Generar JWT
    const payload = {
      sub: usuario.id,
      correo: usuario.correo,
      nombre: usuario.nombre,
      rol: usuario.roles?.nombre || 'SIN_ROL',
      botica_id: sucursalActualBoticaId,
      sucursal_id: sucursalActualId,
    };

    return {
      token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.roles?.nombre || 'SIN_ROL',
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
