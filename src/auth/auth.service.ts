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
    ) { }

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
        // Obtener sucursales del usuario
        const sucursales = await this.prisma.usuario_sucursales.findMany({
            where: {
                usuario_id: usuario.id,
                activo: true,
            },
            include: {
                sucursales: {
                    include: {
                        empresas: true,
                    },
                },
            },
        });

        if (sucursales.length === 0) {
            throw new UnauthorizedException('Usuario sin sucursales asignadas');
        }

        // Encontrar la sucursal principal
        const principal = sucursales.find(s => s.es_principal) || sucursales[0];

        // Generar JWT
        const payload = {
            sub: usuario.id,
            correo: usuario.correo,
            nombre: usuario.nombre,
            rol: usuario.roles.nombre,
            sucursal_id: principal.sucursal_id,
        };

        return {
            token: this.jwtService.sign(payload),
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.roles.nombre,
            },
            sucursal_actual: {
                id: principal.sucursal_id,
                nombre: principal.sucursales.nombre,
                empresa: principal.sucursales.empresas.razon_social,
                es_principal: true,
            },
            sucursales_disponibles: sucursales.map(s => ({
                id: s.sucursal_id,
                nombre: s.sucursales.nombre,
                empresa: s.sucursales.empresas.razon_social,
                es_principal: s.es_principal,
            })),
        };
    }
}