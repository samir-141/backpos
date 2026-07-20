// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.usuarios.findMany({
            where: {
                deleted_at: null,
            },
            select: {
                id: true,
                nombre: true,
                correo: true,
                estado: true,
                roles: {
                    select: {
                        nombre: true,
                    },
                },
                usuario_sucursales_usuario_sucursales_usuario_idTousuarios: {
                    where: {
                        activo: true,
                    },
                    select: {
                        es_principal: true,
                        sucursales: {
                            select: {
                                id: true,
                                nombre: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async findOne(id: string) {
        const usuario = await this.prisma.usuarios.findUnique({
            where: { id },
            include: {
                roles: true,
                usuario_sucursales_usuario_sucursales_usuario_idTousuarios: {
                    where: { activo: true },
                    include: {
                        sucursales: true,
                    },
                },
            },
        });

        if (!usuario || usuario.deleted_at) {
            throw new NotFoundException('Usuario no encontrado');
        }

        return usuario;
    }
}