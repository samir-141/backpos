import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
    private readonly logger = new Logger(UsuariosService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        this.logger.log('Listando todos los usuarios del sistema');

        const usuarios = await this.prisma.usuarios.findMany({
            where: { deleted_at: null },
            orderBy: { created_at: 'desc' },
            include: {
                roles: true,
            }
        });

        return usuarios.map(u => ({
            id: u.id,
            nombre: u.nombre,
            correo: u.correo,
            estado: u.estado,
            rol_id: u.rol_id,
            rol_nombre: u.roles?.nombre || 'Sin Rol',
            created_at: u.created_at,
        }));
    }

    async findOne(id: string) {
        const usuario = await this.prisma.usuarios.findFirst({
            where: { id, deleted_at: null },
            include: {
                roles: true,
            }
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

    async create(dto: CreateUsuarioDto) {
        this.logger.log(`Creando nuevo usuario: ${dto.correo}`);

        const existente = await this.prisma.usuarios.findFirst({
            where: { correo: dto.correo.trim().toLowerCase(), deleted_at: null }
        });

        if (existente) {
            throw new BadRequestException(`El correo electrónico ${dto.correo} ya está registrado en el sistema.`);
        }

        const password_hash = await bcrypt.hash(dto.password, 10);

        const usuario = await this.prisma.usuarios.create({
            data: {
                nombre: dto.nombre.trim(),
                correo: dto.correo.trim().toLowerCase(),
                password_hash,
                rol_id: dto.rol_id,
                estado: dto.estado || 'ACTIVO',
            }
        });

        return {
            exito: true,
            mensaje: 'Usuario creado exitosamente',
            usuario_id: usuario.id,
        };
    }

    async update(id: string, dto: UpdateUsuarioDto) {
        this.logger.log(`Actualizando usuario ID: ${id}`);

        const usuario = await this.prisma.usuarios.findFirst({
            where: { id, deleted_at: null }
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
                }
            });
            if (repetido) {
                throw new BadRequestException(`El correo ${dto.correo} ya está en uso por otro usuario.`);
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
            data: updateData
        });

        return { exito: true, mensaje: 'Usuario actualizado correctamente' };
    }

    async remove(id: string) {
        this.logger.log(`Eliminando usuario ID: ${id}`);

        const usuario = await this.prisma.usuarios.findFirst({
            where: { id, deleted_at: null }
        });

        if (!usuario) {
            throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }

        await this.prisma.usuarios.update({
            where: { id },
            data: {
                deleted_at: new Date(),
                estado: 'INACTIVO',
            }
        });

        return { mensaje: `Usuario "${usuario.nombre}" eliminado correctamente` };
    }

    async getRoles() {
        return await this.prisma.roles.findMany({
            where: { deleted_at: null },
            include: {
                rol_permisos: {
                    include: { permisos: true }
                }
            },
            orderBy: { nombre: 'asc' }
        });
    }

    async getSucursales() {
        const sucursales = await this.prisma.sucursales.findMany({
            where: { deleted_at: null },
            include: {
                cajas: {
                    where: { deleted_at: null }
                }
            },
            orderBy: { nombre: 'asc' }
        });

        return sucursales.map(s => ({
            id: s.id,
            nombre: s.nombre,
            direccion: s.direccion,
            telefono: s.telefono || 'Sin teléfono',
            total_cajas: s.cajas.length,
            created_at: s.created_at,
        }));
    }

    async createSucursal(dto: { nombre: string; direccion: string; telefono?: string }) {
        this.logger.log(`Creando sucursal: ${dto.nombre}`);

        let empresa = await this.prisma.empresas.findFirst({ where: { deleted_at: null } });
        if (!empresa) {
            empresa = await this.prisma.empresas.create({
                data: {
                    ruc: '20000000001',
                    razon_social: 'FARMA POS S.A.C.',
                    direccion: 'AV. PRINCIPAL 100',
                }
            });
        }

        const sucursal = await this.prisma.sucursales.create({
            data: {
                empresa_id: empresa.id,
                nombre: dto.nombre.trim(),
                direccion: dto.direccion.trim(),
                telefono: dto.telefono?.trim() || null,
            }
        });

        // Crear caja por defecto
        await this.prisma.cajas.create({
            data: {
                sucursal_id: sucursal.id,
                nombre: `Caja Principal - ${sucursal.nombre}`,
                estado: 'ABIERTA',
            }
        });

        return { exito: true, mensaje: 'Sucursal registrada correctamente', sucursal_id: sucursal.id };
    }

}
