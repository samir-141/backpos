import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/security/encryption.service';
import { ComprobanteStorageService } from '../facturacion/storage/comprobante-storage.service';
import { FirmaService } from '../facturacion/firma/firma.service';
import { CreatePerfilTributarioDto } from './dto/create-perfil-tributario.dto';
import { UpdatePerfilTributarioDto } from './dto/update-perfil-tributario.dto';
import { GuardarConfigEmisionDto } from './dto/guardar-config-emision.dto';
import {
  comprobantesPermitidos,
  errorCoherenciaRucRegimen,
  requiereCertificadoDigital,
} from '../facturacion/domain/emision-permitida.domain';

import {
  perfiles_tributarios,
  configuraciones_emision,
} from '../../generated/prisma/client';

import { consultarPadron } from '../../common/integrations/padron.client';

type PerfilWithConfig = perfiles_tributarios & {
  configuracion_emision?: configuraciones_emision | null;
};

const EXTENSIONES_CERTIFICADO = ['.pfx', '.p12'];
const TAMANO_MAX_CERTIFICADO = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class PerfilesTributariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly storage: ComprobanteStorageService,
    private readonly firma: FirmaService,
  ) {}

  async listar(boticaId: string) {
    const perfiles = await this.prisma.perfiles_tributarios.findMany({
      where: { botica_id: boticaId, deleted_at: null },
      include: { configuracion_emision: true },
      orderBy: [{ es_principal: 'desc' }, { created_at: 'asc' }],
    });

    return perfiles.map((p) => this.sanitizar(p));
  }

  async obtener(boticaId: string, id: string) {
    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: { id, botica_id: boticaId, deleted_at: null },
      include: { configuracion_emision: true },
    });
    if (!perfil) {
      throw new NotFoundException('Perfil tributario no encontrado');
    }
    return this.sanitizar(perfil);
  }

  async crear(
    boticaId: string,
    dto: CreatePerfilTributarioDto,
    usuarioId: string,
  ) {
    const incoherencia = errorCoherenciaRucRegimen(
      dto.ruc,
      dto.regimen_tributario,
    );
    if (incoherencia) {
      throw new BadRequestException(incoherencia);
    }

    const existente = await this.prisma.perfiles_tributarios.findFirst({
      where: { botica_id: boticaId, ruc: dto.ruc, deleted_at: null },
    });
    if (existente) {
      throw new BadRequestException(
        `Ya existe un perfil registrado con el RUC ${dto.ruc} en esta empresa.`,
      );
    }

    if (dto.es_principal) {
      await this.prisma.perfiles_tributarios.updateMany({
        where: { botica_id: boticaId, deleted_at: null },
        data: { es_principal: false },
      });
    }

    // Default emission system based on regime
    const defaultSistema =
      dto.regimen_tributario === 'NRUS' ||
      dto.regimen_tributario === 'NUEVO_RUS'
        ? 'SEE_CF'
        : 'SEE_CONTRIBUYENTE';

    const nuevo = await this.prisma.perfiles_tributarios.create({
      data: {
        botica_id: boticaId,
        ruc: dto.ruc,
        razon_social: dto.razon_social,
        nombre_comercial: dto.nombre_comercial,
        tipo_contribuyente: dto.tipo_contribuyente,
        regimen_tributario: dto.regimen_tributario,
        direccion_fiscal: dto.direccion_fiscal,
        ubigeo: dto.ubigeo,
        departamento: dto.departamento,
        provincia: dto.provincia,
        distrito: dto.distrito,
        telefono: dto.telefono,
        email: dto.email,
        es_principal: dto.es_principal ?? false,
        activo: dto.activo ?? true,
        created_by: usuarioId,
        updated_by: usuarioId,
        configuracion_emision: {
          create: {
            sistema_emision: defaultSistema,
            proveedor_tipo: 'SUNAT_DIRECTO',
            ambiente: 'BETA',
            activo: true,
            created_by: usuarioId,
            updated_by: usuarioId,
          },
        },
      },
      include: { configuracion_emision: true },
    });

    return this.sanitizar(nuevo);
  }

  async actualizar(
    boticaId: string,
    id: string,
    dto: UpdatePerfilTributarioDto,
    usuarioId: string,
  ) {
    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: { id, botica_id: boticaId, deleted_at: null },
    });
    if (!perfil) {
      throw new NotFoundException('Perfil tributario no encontrado');
    }

    const rucTarget = dto.ruc ?? perfil.ruc;
    const regimenTarget = dto.regimen_tributario ?? perfil.regimen_tributario;
    const incoherencia = errorCoherenciaRucRegimen(rucTarget, regimenTarget);
    if (incoherencia) {
      throw new BadRequestException(incoherencia);
    }

    if (dto.ruc && dto.ruc !== perfil.ruc) {
      const repetido = await this.prisma.perfiles_tributarios.findFirst({
        where: {
          id: { not: id },
          botica_id: boticaId,
          ruc: dto.ruc,
          deleted_at: null,
        },
      });
      if (repetido) {
        throw new BadRequestException(
          `Ya existe otro perfil registrado con el RUC ${dto.ruc}`,
        );
      }
    }

    if (dto.es_principal) {
      await this.prisma.perfiles_tributarios.updateMany({
        where: { id: { not: id }, botica_id: boticaId, deleted_at: null },
        data: { es_principal: false },
      });
    }

    const actualizado = await this.prisma.perfiles_tributarios.update({
      where: { id },
      data: {
        ruc: dto.ruc,
        razon_social: dto.razon_social,
        nombre_comercial: dto.nombre_comercial,
        tipo_contribuyente: dto.tipo_contribuyente,
        regimen_tributario: dto.regimen_tributario,
        direccion_fiscal: dto.direccion_fiscal,
        ubigeo: dto.ubigeo,
        departamento: dto.departamento,
        provincia: dto.provincia,
        distrito: dto.distrito,
        telefono: dto.telefono,
        email: dto.email,
        es_principal: dto.es_principal,
        activo: dto.activo,
        updated_by: usuarioId,
        updated_at: new Date(),
      },
      include: { configuracion_emision: true },
    });

    return this.sanitizar(actualizado);
  }

  async eliminar(boticaId: string, id: string, usuarioId: string) {
    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: { id, botica_id: boticaId, deleted_at: null },
    });
    if (!perfil) {
      throw new NotFoundException('Perfil tributario no encontrado');
    }

    await this.prisma.perfiles_tributarios.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_by: usuarioId,
        activo: false,
      },
    });

    return { mensaje: 'Perfil tributario eliminado correctamente' };
  }

  async guardarConfigEmision(
    boticaId: string,
    perfilId: string,
    dto: GuardarConfigEmisionDto,
    usuarioId: string,
  ) {
    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: { id: perfilId, botica_id: boticaId, deleted_at: null },
      include: { configuracion_emision: true },
    });
    if (!perfil) {
      throw new NotFoundException('Perfil tributario no encontrado');
    }

    const data: Record<string, unknown> = {
      sistema_emision:
        dto.sistema_emision ??
        perfil.configuracion_emision?.sistema_emision ??
        'SEE_CONTRIBUYENTE',
      proveedor_tipo:
        dto.proveedor_tipo ??
        perfil.configuracion_emision?.proveedor_tipo ??
        'SUNAT_DIRECTO',
      ambiente:
        dto.ambiente ?? perfil.configuracion_emision?.ambiente ?? 'BETA',
      pse_id: dto.pse_id ?? perfil.configuracion_emision?.pse_id,
      ose_id: dto.ose_id ?? perfil.configuracion_emision?.ose_id,
      activo: dto.activo ?? perfil.configuracion_emision?.activo ?? true,
      updated_by: usuarioId,
      updated_at: new Date(),
    };

    if (dto.sol_usuario !== undefined) {
      data.sol_usuario_encriptado = dto.sol_usuario
        ? this.encryption.encrypt(dto.sol_usuario)
        : null;
    }
    if (dto.sol_clave !== undefined) {
      data.sol_clave_encriptada = dto.sol_clave
        ? this.encryption.encrypt(dto.sol_clave)
        : null;
    }
    if (dto.certificado_clave !== undefined) {
      data.certificado_clave_encriptada = dto.certificado_clave
        ? this.encryption.encrypt(dto.certificado_clave)
        : null;
    }

    const config = perfil.configuracion_emision
      ? await this.prisma.configuraciones_emision.update({
          where: { id: perfil.configuracion_emision.id },
          data,
        })
      : await this.prisma.configuraciones_emision.create({
          data: {
            ...(data as object),
            perfil_tributario_id: perfilId,
            created_by: usuarioId,
          } as never,
        });

    return this.sanitizar({ ...perfil, configuracion_emision: config });
  }

  async guardarCertificado(
    boticaId: string,
    perfilId: string,
    archivo: { buffer: Buffer; originalname: string; size: number },
    clave: string,
    usuarioId: string,
  ) {
    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: { id: perfilId, botica_id: boticaId, deleted_at: null },
      include: { configuracion_emision: true },
    });
    if (!perfil) {
      throw new NotFoundException('Perfil tributario no encontrado');
    }

    const extension = archivo.originalname
      .toLowerCase()
      .slice(archivo.originalname.lastIndexOf('.'));
    if (!EXTENSIONES_CERTIFICADO.includes(extension)) {
      throw new BadRequestException(
        'El certificado debe ser un archivo .pfx o .p12',
      );
    }
    if (archivo.size > TAMANO_MAX_CERTIFICADO) {
      throw new BadRequestException(
        'El certificado supera el tamaño máximo (5 MB)',
      );
    }

    // Valida que el certificado sea legible con la clave
    const extraido = this.firma.extraerCertificado(archivo.buffer, clave);

    const ruta = await this.storage.guardar(
      `empresas/${perfil.ruc}/certificado/certificado${extension}`,
      archivo.buffer,
    );

    const config = perfil.configuracion_emision
      ? await this.prisma.configuraciones_emision.update({
          where: { id: perfil.configuracion_emision.id },
          data: {
            certificado_nombre: archivo.originalname,
            certificado_path: ruta,
            certificado_clave_encriptada: this.encryption.encrypt(clave),
            certificado_fecha_vencimiento: extraido.fechaVencimiento,
            verificado: true,
            updated_by: usuarioId,
            updated_at: new Date(),
          },
        })
      : await this.prisma.configuraciones_emision.create({
          data: {
            perfil_tributario_id: perfilId,
            certificado_nombre: archivo.originalname,
            certificado_path: ruta,
            certificado_clave_encriptada: this.encryption.encrypt(clave),
            certificado_fecha_vencimiento: extraido.fechaVencimiento,
            verificado: true,
            created_by: usuarioId,
            updated_by: usuarioId,
          },
        });

    return {
      ...this.sanitizar({ ...perfil, configuracion_emision: config }),
      certificado_titular: extraido.titular,
    };
  }

  async obtenerCapacidades(boticaId: string, perfilId: string) {
    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: { id: perfilId, botica_id: boticaId, deleted_at: null },
      include: { configuracion_emision: true },
    });
    if (!perfil) {
      throw new NotFoundException('Perfil tributario no encontrado');
    }

    const cfg = perfil.configuracion_emision;
    const reqCert = requiereCertificadoDigital(
      perfil.regimen_tributario,
      cfg?.sistema_emision,
    );

    const tieneSol = Boolean(
      cfg?.sol_usuario_encriptado && cfg?.sol_clave_encriptada,
    );
    const tieneCert = Boolean(
      cfg?.certificado_path && cfg?.certificado_clave_encriptada,
    );
    const certVencido = Boolean(
      cfg?.certificado_fecha_vencimiento &&
      cfg.certificado_fecha_vencimiento < new Date(),
    );

    const faltantes: string[] = [];
    if (
      !tieneSol &&
      cfg?.sistema_emision !== 'MANUAL' &&
      cfg?.sistema_emision !== 'SEE_CF'
    ) {
      faltantes.push('credenciales_sol');
    }
    if (reqCert && !tieneCert) {
      faltantes.push('certificado_digital');
    }
    if (tieneCert && certVencido) {
      faltantes.push('certificado_vencido');
    }

    return {
      perfil_id: perfil.id,
      ruc: perfil.ruc,
      razon_social: perfil.razon_social,
      regimen_tributario: perfil.regimen_tributario,
      comprobantes_permitidos: comprobantesPermitidos(
        perfil.regimen_tributario,
      ),
      permite_factura: comprobantesPermitidos(
        perfil.regimen_tributario,
      ).includes('01'),
      permite_boleta: comprobantesPermitidos(
        perfil.regimen_tributario,
      ).includes('03'),
      requiere_certificado: reqCert,
      tiene_certificado: tieneCert,
      tiene_credenciales_sol: tieneSol,
      listo_para_emitir: faltantes.length === 0,
      faltantes,
    };
  }

  async verificar(boticaId: string, perfilId: string, usuarioId: string) {
    const caps = await this.obtenerCapacidades(boticaId, perfilId);
    const valido = caps.listo_para_emitir;
    let mensaje = '';
    if (valido) {
      mensaje = `Perfil ${caps.razon_social} (${caps.ruc}) verificado correctamente y habilitado para emitir comprobantes.`;
    } else {
      mensaje = `Perfil ${caps.razon_social} (${caps.ruc}): Configuración incompleta. Faltan: ${caps.faltantes.join(', ')}.`;
    }

    const perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: { id: perfilId, botica_id: boticaId, deleted_at: null },
      include: { configuracion_emision: true },
    });
    if (perfil?.configuracion_emision) {
      await this.prisma.configuraciones_emision.update({
        where: { id: perfil.configuracion_emision.id },
        data: {
          verificado: valido,
          updated_by: usuarioId,
          updated_at: new Date(),
        },
      });
    }

    return {
      valido,
      mensaje,
      detalles: caps,
    };
  }

  async consultarRuc(ruc: string) {
    const rucLimpio = ruc.trim();
    if (!/^\d{11}$/.test(rucLimpio)) {
      throw new BadRequestException('El RUC debe tener 11 dígitos numéricos');
    }

    const res = await consultarPadron('RUC', rucLimpio);
    if (!res.ok || !res.data) {
      throw new BadRequestException(
        res.error || 'No se pudo consultar el RUC en SUNAT',
      );
    }

    const data = res.data as Record<string, any>;
    return {
      ruc: rucLimpio,
      razonSocial:
        data.nombre || data.razonSocial || data.razon_social || '',
      nombreComercial:
        data.nombreComercial || data.nombre_comercial || '',
      tipoContribuyente:
        data.tipo ||
        (rucLimpio.startsWith('20')
          ? 'PERSONA_JURIDICA'
          : 'PERSONA_NATURAL'),
      estado: data.estado || 'ACTIVO',
      condicion: data.condicion || 'HABIDO',
      direccion: data.direccion || data.direccionCompleta || '',
      ubigeo: data.ubigeo || '',
      departamento: data.departamento || '',
      provincia: data.provincia || '',
      distrito: data.distrito || '',
    };
  }

  private sanitizar(perfil: PerfilWithConfig) {
    const cfg = perfil.configuracion_emision;
    const reqCert = requiereCertificadoDigital(
      perfil.regimen_tributario,
      cfg?.sistema_emision,
    );

    return {
      id: perfil.id,
      botica_id: perfil.botica_id,
      ruc: perfil.ruc,
      razon_social: perfil.razon_social,
      nombre_comercial: perfil.nombre_comercial,
      tipo_contribuyente: perfil.tipo_contribuyente,
      regimen_tributario: perfil.regimen_tributario,
      direccion_fiscal: perfil.direccion_fiscal,
      ubigeo: perfil.ubigeo,
      departamento: perfil.departamento,
      provincia: perfil.provincia,
      distrito: perfil.distrito,
      telefono: perfil.telefono,
      email: perfil.email,
      estado_sunat: perfil.estado_sunat,
      condicion_sunat: perfil.condicion_sunat,
      es_principal: perfil.es_principal,
      activo: perfil.activo,
      comprobantes_permitidos: comprobantesPermitidos(
        perfil.regimen_tributario,
      ),
      permite_factura: comprobantesPermitidos(
        perfil.regimen_tributario,
      ).includes('01'),
      permite_boleta: comprobantesPermitidos(
        perfil.regimen_tributario,
      ).includes('03'),
      requiere_certificado: reqCert,
      configuracion_emision: cfg
        ? {
            id: cfg.id,
            sistema_emision: cfg.sistema_emision,
            proveedor_tipo: cfg.proveedor_tipo,
            ambiente: cfg.ambiente,
            pse_id: cfg.pse_id,
            ose_id: cfg.ose_id,
            tiene_credenciales_sol: Boolean(
              cfg.sol_usuario_encriptado && cfg.sol_clave_encriptada,
            ),
            tiene_certificado: Boolean(
              cfg.certificado_nombre && cfg.certificado_clave_encriptada,
            ),
            certificado_nombre: cfg.certificado_nombre,
            certificado_fecha_vencimiento: cfg.certificado_fecha_vencimiento,
            verificado: cfg.verificado,
            activo: cfg.activo,
          }
        : null,
      created_at: perfil.created_at,
      updated_at: perfil.updated_at,
    };
  }
}
