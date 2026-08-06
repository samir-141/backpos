import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { ComprobanteStorageService } from '../storage/comprobante-storage.service';
import { FirmaService } from '../firma/firma.service';
import { GuardarConfiguracionTributariaDto } from '../dtos/configuracion-tributaria.dto';
import {
  comprobantesPermitidos,
  errorCoherenciaRucRegimen,
} from '../domain/emision-permitida.domain';

const EXTENSIONES_CERTIFICADO = ['.pfx', '.p12'];
const TAMANO_MAX_CERTIFICADO = 5 * 1024 * 1024; // 5 MB

/**
 * Configuración tributaria por empresa. Las credenciales SOL y la
 * contraseña del certificado se guardan cifradas y jamás se devuelven
 * completas por la API (solo indicadores de existencia).
 */
@Injectable()
export class ConfiguracionTributariaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly storage: ComprobanteStorageService,
    private readonly firma: FirmaService,
  ) {}

  async obtener(boticaId: string) {
    const config = await this.prisma.configuraciones_tributarias.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });
    if (!config) return null;
    return this.sanitizar(config);
  }

  async obtenerBotica(boticaId: string) {
    return this.prisma.boticas.findUnique({
      where: { id: boticaId },
      select: {
        nombre: true,
        razon_social: true,
        ruc: true,
        direccion: true,
        telefono: true,
      },
    });
  }

  async guardar(
    dto: GuardarConfiguracionTributariaDto,
    boticaId: string,
    usuarioId: string,
  ) {
    const incoherencia = errorCoherenciaRucRegimen(
      dto.ruc,
      dto.regimenTributario,
    );
    if (incoherencia) {
      throw new BadRequestException(incoherencia);
    }

    const existente = await this.prisma.configuraciones_tributarias.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });

    const data: Record<string, unknown> = {
      ruc: dto.ruc,
      razon_social: dto.razonSocial,
      nombre_comercial: dto.nombreComercial,
      ubigeo: dto.ubigeo,
      departamento: dto.departamento,
      provincia: dto.provincia,
      distrito: dto.distrito,
      direccion_fiscal: dto.direccionFiscal,
      regimen_tributario: dto.regimenTributario,
      emisor_electronico:
        dto.emisorElectronico ?? existente?.emisor_electronico ?? false,
      ambiente: dto.ambiente ?? existente?.ambiente ?? 'BETA',
      activo: dto.activo ?? existente?.activo ?? true,
      updated_by: usuarioId,
      updated_at: new Date(),
    };

    // Solo se recifran si el cliente envía valores nuevos
    if (dto.solUsuario !== undefined) {
      data.sol_usuario_encriptado = dto.solUsuario
        ? this.encryption.encrypt(dto.solUsuario)
        : null;
    }
    if (dto.solClave !== undefined) {
      data.sol_clave_encriptada = dto.solClave
        ? this.encryption.encrypt(dto.solClave)
        : null;
    }
    if (dto.certificadoClave !== undefined) {
      data.certificado_clave_encriptada = dto.certificadoClave
        ? this.encryption.encrypt(dto.certificadoClave)
        : null;
    }

    const config = existente
      ? await this.prisma.configuraciones_tributarias.update({
          where: { id: existente.id },
          data,
        })
      : await this.prisma.configuraciones_tributarias.create({
          data: {
            ...(data as object),
            botica_id: boticaId,
            created_by: usuarioId,
          } as never,
        });

    return this.sanitizar(config);
  }

  /** Registra el certificado digital (validando que sea legible). */
  async guardarCertificado(
    boticaId: string,
    archivo: { buffer: Buffer; originalname: string; size: number },
    clave: string,
    usuarioId: string,
  ) {
    const config = await this.prisma.configuraciones_tributarias.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });
    if (!config) {
      throw new NotFoundException(
        'Primero registre la configuración tributaria',
      );
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

    // Valida que el certificado sea legible con la clave dada
    const extraido = this.firma.extraerCertificado(archivo.buffer, clave);

    const ruta = await this.storage.guardar(
      `empresas/${config.ruc}/certificado/certificado${extension}`,
      archivo.buffer,
    );

    const actualizada = await this.prisma.configuraciones_tributarias.update({
      where: { id: config.id },
      data: {
        certificado_nombre: archivo.originalname,
        certificado_path: ruta,
        certificado_clave_encriptada: this.encryption.encrypt(clave),
        certificado_fecha_vencimiento: extraido.fechaVencimiento,
        updated_by: usuarioId,
        updated_at: new Date(),
      },
    });

    return {
      ...this.sanitizar(actualizada),
      certificado_titular: extraido.titular,
    };
  }

  /** Comprueba que las credenciales y el certificado estén completos. */
  async estadoParaEmision(boticaId: string) {
    const config = await this.prisma.configuraciones_tributarias.findFirst({
      where: { botica_id: boticaId, deleted_at: null },
    });
    if (!config) {
      return { listo: false, faltantes: ['configuracion'] };
    }
    const faltantes: string[] = [];
    if (!config.sol_usuario_encriptado || !config.sol_clave_encriptada) {
      faltantes.push('credenciales_sol');
    }
    if (!config.certificado_path || !config.certificado_clave_encriptada) {
      faltantes.push('certificado');
    }
    if (
      config.certificado_fecha_vencimiento &&
      config.certificado_fecha_vencimiento < new Date()
    ) {
      faltantes.push('certificado_vencido');
    }
    return { listo: faltantes.length === 0, faltantes };
  }

  /** Nunca expone secretos: solo indica si existen. */
  private sanitizar(config: {
    id: string;
    ruc: string;
    razon_social: string;
    nombre_comercial: string | null;
    codigo_pais: string;
    ubigeo: string | null;
    departamento: string | null;
    provincia: string | null;
    distrito: string | null;
    direccion_fiscal: string;
    regimen_tributario: string;
    emisor_electronico: boolean;
    ambiente: string;
    proveedor_facturacion: string;
    sol_usuario_encriptado: string | null;
    sol_clave_encriptada: string | null;
    certificado_nombre: string | null;
    certificado_fecha_vencimiento: Date | null;
    certificado_clave_encriptada: string | null;
    activo: boolean;
  }) {
    return {
      id: config.id,
      ruc: config.ruc,
      razon_social: config.razon_social,
      nombre_comercial: config.nombre_comercial,
      codigo_pais: config.codigo_pais,
      ubigeo: config.ubigeo,
      departamento: config.departamento,
      provincia: config.provincia,
      distrito: config.distrito,
      direccion_fiscal: config.direccion_fiscal,
      regimen_tributario: config.regimen_tributario,
      comprobantes_permitidos: comprobantesPermitidos(
        config.regimen_tributario,
      ),
      emisor_electronico: config.emisor_electronico,
      ambiente: config.ambiente,
      proveedor_facturacion: config.proveedor_facturacion,
      tiene_credenciales_sol: Boolean(
        config.sol_usuario_encriptado && config.sol_clave_encriptada,
      ),
      certificado_nombre: config.certificado_nombre,
      certificado_fecha_vencimiento: config.certificado_fecha_vencimiento,
      tiene_certificado: Boolean(
        config.certificado_nombre && config.certificado_clave_encriptada,
      ),
      activo: config.activo,
    };
  }
}
