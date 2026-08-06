import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isValidPeruvianRuc } from '../../common/validators/documento.validator';
import {
  CreateProveedorDto,
  QueryProveedoresDto,
  UpdateProveedorDto,
} from './dto/proveedor.dto';

export { isValidPeruvianRuc };

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(boticaId: string, usuarioId: string, dto: CreateProveedorDto) {
    const data = this.normalizeCreate(dto);
    this.assertValidRuc(data.ruc);
    await this.assertRucAvailable(boticaId, data.ruc);

    try {
      return await this.prisma.proveedores.create({
        data: {
          botica_id: boticaId,
          ...data,
          created_by: usuarioId,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Ya existe un proveedor activo con ese RUC.',
        );
      }
      throw error;
    }
  }

  async findAll(boticaId: string, query: QueryProveedoresDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const buscar = query.buscar?.trim();
    const where = {
      botica_id: boticaId,
      deleted_at: null,
      ...(buscar
        ? {
            OR: [
              { ruc: { contains: buscar } },
              {
                razon_social: {
                  contains: buscar,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.proveedores.findMany({
        where,
        orderBy: { razon_social: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.proveedores.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(boticaId: string, id: string) {
    const proveedor = await this.prisma.proveedores.findFirst({
      where: { id, botica_id: boticaId, deleted_at: null },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado.');
    return proveedor;
  }

  async update(
    boticaId: string,
    usuarioId: string,
    id: string,
    dto: UpdateProveedorDto,
  ) {
    await this.findOne(boticaId, id);
    const data = this.normalize(dto);
    if (data.ruc) {
      this.assertValidRuc(data.ruc);
      await this.assertRucAvailable(boticaId, data.ruc, id);
    }
    try {
      return await this.prisma.proveedores.update({
        where: { id },
        data: { ...data, updated_by: usuarioId, updated_at: new Date() },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Ya existe un proveedor activo con ese RUC.',
        );
      }
      throw error;
    }
  }

  async remove(boticaId: string, usuarioId: string, id: string) {
    await this.findOne(boticaId, id);
    await this.prisma.proveedores.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: usuarioId,
        updated_at: new Date(),
      },
    });
    return { success: true, message: 'Proveedor eliminado correctamente.' };
  }

  private normalize<T extends CreateProveedorDto | UpdateProveedorDto>(dto: T) {
    return {
      ...(dto.ruc !== undefined ? { ruc: this.requiredText(dto.ruc) } : {}),
      ...(dto.razon_social !== undefined
        ? { razon_social: this.requiredText(dto.razon_social) }
        : {}),
      ...(dto.direccion !== undefined
        ? { direccion: this.optionalText(dto.direccion) }
        : {}),
      ...(dto.telefono !== undefined
        ? { telefono: this.optionalText(dto.telefono) }
        : {}),
      ...(dto.email !== undefined
        ? { email: this.optionalText(dto.email)?.toLowerCase() ?? null }
        : {}),
    };
  }

  private normalizeCreate(dto: CreateProveedorDto) {
    const data = this.normalize(dto);
    if (!data.razon_social) {
      throw new BadRequestException('La razón social es obligatoria.');
    }
    return {
      ...data,
      ruc: this.requiredText(dto.ruc),
      razon_social: data.razon_social,
    };
  }

  private requiredText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private optionalText(value: unknown): string | null {
    const normalized = this.requiredText(value);
    return normalized || null;
  }

  private assertValidRuc(ruc?: string): asserts ruc is string {
    if (!ruc || !isValidPeruvianRuc(ruc)) {
      throw new BadRequestException('El RUC ingresado no es válido.');
    }
  }

  private async assertRucAvailable(
    boticaId: string,
    ruc: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.proveedores.findFirst({
      where: {
        botica_id: boticaId,
        ruc,
        deleted_at: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Ya existe un proveedor activo con ese RUC.');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
