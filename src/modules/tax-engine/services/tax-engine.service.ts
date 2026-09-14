import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EvaluateSaleTaxDto } from '../dto/evaluate-sale-tax.dto';
import { TaxEvaluationResultDto } from '../dto/tax-evaluation-result.dto';
import { TaxRuleStrategy } from '../interfaces/tax-rule-strategy.interface';
import { NrusRuleStrategy } from '../rules/nrus-rule.strategy';
import { RmtRuleStrategy } from '../rules/rmt-rule.strategy';
import { RerRuleStrategy } from '../rules/rer-rule.strategy';
import { GeneralRuleStrategy } from '../rules/general-rule.strategy';
import { TaxValidatorService } from './tax-validator.service';

@Injectable()
export class TaxEngineService {
  private readonly strategies: TaxRuleStrategy[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TaxValidatorService,
    nrusRule: NrusRuleStrategy,
    rmtRule: RmtRuleStrategy,
    rerRule: RerRuleStrategy,
    generalRule: GeneralRuleStrategy,
  ) {
    this.strategies = [nrusRule, rmtRule, rerRule, generalRule];
  }

  async getActiveTaxProfile(boticaId: string, perfilId?: string) {
    if (perfilId) {
      const perfil = await this.prisma.perfiles_tributarios.findFirst({
        where: { id: perfilId, botica_id: boticaId, deleted_at: null },
        include: { configuracion_emision: true },
      });
      if (!perfil) {
        throw new NotFoundException(
          `Perfil tributario con id ${perfilId} no encontrado para esta empresa.`,
        );
      }
      return perfil;
    }

    // Default to main profile or first active
    let perfil = await this.prisma.perfiles_tributarios.findFirst({
      where: {
        botica_id: boticaId,
        es_principal: true,
        activo: true,
        deleted_at: null,
      },
      include: { configuracion_emision: true },
    });

    if (!perfil) {
      perfil = await this.prisma.perfiles_tributarios.findFirst({
        where: { botica_id: boticaId, activo: true, deleted_at: null },
        include: { configuracion_emision: true },
        orderBy: { created_at: 'asc' },
      });
    }

    return perfil;
  }

  async evaluateSale(
    boticaId: string,
    dto: EvaluateSaleTaxDto,
  ): Promise<TaxEvaluationResultDto> {
    const perfil = await this.getActiveTaxProfile(
      boticaId,
      dto.perfilTributarioId,
    );

    const warnings: string[] = [];
    const errors: string[] = [];

    if (!perfil) {
      return {
        perfilTributarioId: '',
        ruc: '',
        razonSocial: 'Sin perfil tributario configurado',
        regimen: 'SIN_CONFIGURACION',
        sistemaEmision: 'MANUAL',
        ambiente: 'BETA',
        total: dto.total,
        allowedDocumentTypes: [
          {
            tipo: 'NOTA_VENTA',
            descripcion: 'Nota de Venta Interna (Sin comprobante SUNAT)',
            habilitado: true,
          },
        ],
        documentRequired: false,
        customerDocumentRequired: false,
        requiresValidRuc: false,
        canConsolidateDaily: false,
        valid: true,
        errors: [],
        warnings: [
          'La empresa no tiene un perfil tributario configurado. Solo se podrán emitir notas de venta internas.',
        ],
      };
    }

    const regimen = perfil.regimen_tributario || 'NRUS';
    const config = perfil.configuracion_emision;
    const sistemaEmision =
      config?.sistema_emision ||
      (regimen === 'NRUS' ? 'SEE_CF' : 'SEE_CONTRIBUYENTE');
    const ambiente = config?.ambiente || 'BETA';

    const strategy = this.strategies.find((s) => s.supports(regimen));
    if (!strategy) {
      throw new BadRequestException(
        `No existe una estrategia de reglas tributarias para el régimen ${regimen}.`,
      );
    }

    const evaluation = strategy.evaluate({
      regimen,
      sistemaEmision,
      total: dto.total,
      tipoDocumentoSeleccionado: dto.tipoDocumentoSeleccionado,
      cliente: dto.cliente,
    });

    // Validate customer doc if provided
    if (dto.cliente?.numeroDoc) {
      const doc = dto.cliente.numeroDoc.trim();
      const tipo = dto.cliente.tipoDoc || (doc.length === 11 ? '6' : '1');

      if (tipo === '6') {
        if (!this.validator.validarRuc(doc)) {
          errors.push(
            `El RUC ${doc} no tiene un formato o dígito verificador válido.`,
          );
        }
      } else if (tipo === '1') {
        if (!this.validator.validarDni(doc)) {
          errors.push(
            `El DNI ${doc} debe tener exactamente 8 dígitos numéricos.`,
          );
        }
      } else if (tipo === '4') {
        if (!this.validator.validarCe(doc)) {
          errors.push(
            `El Carné de Extranjería ${doc} no tiene un formato válido.`,
          );
        }
      }
    }

    errors.push(...evaluation.errors);

    return {
      perfilTributarioId: perfil.id,
      ruc: perfil.ruc,
      razonSocial: perfil.razon_social,
      regimen,
      sistemaEmision,
      ambiente,
      total: dto.total,
      allowedDocumentTypes: evaluation.allowedDocumentTypes,
      documentRequired: evaluation.documentRequired,
      customerDocumentRequired: evaluation.customerDocumentRequired,
      requiresValidRuc: evaluation.requiresValidRuc,
      canConsolidateDaily: evaluation.canConsolidateDaily,
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async getEngineStatus(boticaId: string) {
    const perfil = await this.getActiveTaxProfile(boticaId);
    const pendingQueueCount = await this.prisma.comprobantes_electronicos.count(
      {
        where: {
          botica_id: boticaId,
          estado: { in: ['LOCAL', 'PENDIENTE', 'PENDING'] },
        },
      },
    );

    const rejectedCount = await this.prisma.comprobantes_electronicos.count({
      where: {
        botica_id: boticaId,
        estado: 'RECHAZADO',
      },
    });

    return {
      boticaId,
      hasTaxProfile: Boolean(perfil),
      activeProfile: perfil
        ? {
            id: perfil.id,
            ruc: perfil.ruc,
            razonSocial: perfil.razon_social,
            regimen: perfil.regimen_tributario,
            sistemaEmision:
              perfil.configuracion_emision?.sistema_emision || 'SEE_CF',
            ambiente: perfil.configuracion_emision?.ambiente || 'BETA',
            verificado: perfil.configuracion_emision?.verificado ?? false,
          }
        : null,
      queue: {
        pending: pendingQueueCount,
        rejected: rejectedCount,
        status:
          rejectedCount > 0
            ? 'ERROR'
            : pendingQueueCount > 0
              ? 'SYNCING'
              : 'ONLINE',
      },
    };
  }
}
