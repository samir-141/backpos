// src/reportes/reportes.controller.ts
import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
@Controller('usuarios')
export class UsuariosController {
    constructor(private readonly prisma: PrismaService) { }

    // 1. Gráfico de Evolución de Ventas (Agrupado por Fecha)
    @Get('usuario')
    async getUsuarios() {
        const agrupado = await this.prisma.usuarios.findMany({
            where: {
                estado: 'ACTIVO',
                deleted_at: null,
            },
            orderBy: { nombre: 'asc' },
        });
        const roles = await this.prisma.roles.findMany();
        // Formateamos la respuesta para que el Frontend reciba las llaves exactas de tu interfaz VentaGrafico
        return agrupado.map((v) => ({
            id: v.id,
            nombre: v.nombre,
            correo: v.correo,
            rol: roles.map((r) => r.nombre),
            estado: v.estado,
        }));
    }
    @Get('usuario/:id')  // ← Corregido
    async getUsuarioById(@Param('id') id: string) {
        const usuario = await this.prisma.usuarios.findUnique({
            where: {
                id: id,
            }
        });
        const roles = await this.prisma.roles.findMany();
        if (!usuario) {
            throw new NotFoundException(`Usuario con id ${id} no encontrado`);
        }

        return {
            id: usuario.id,
            nombre: usuario.nombre,
            correo: usuario.correo,
            estado: usuario.estado,
            roles: roles.filter((rol) => rol.id === usuario.rol_id).map((rol) => rol.nombre), // o rol.id si prefieres
            // roles: usuario.roles, // si quieres el objeto completo
        };
    }


}