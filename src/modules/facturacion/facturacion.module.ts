import { Module } from '@nestjs/common';
import { FacturacionController } from './controllers/facturacion.controller';
import { ConfiguracionTributariaController } from './controllers/configuracion-tributaria.controller';
import { ResumenDiarioController } from './controllers/resumen-diario.controller';
import { FacturacionService } from './services/facturacion.service';
import { ConfiguracionTributariaService } from './services/configuracion-tributaria.service';
import { CorrelativosService } from './services/correlativos.service';
import { TributosCalculatorService } from './services/tributos-calculator.service';
import { ComprobanteValidationService } from './services/comprobante-validation.service';
import { ResumenDiarioService } from './services/resumen-diario.service';
import { VentaToComprobanteMapper } from './mappers/venta-to-comprobante.mapper';
import { XmlBuilderService } from './builders/xml-builder.service';
import { ResumenDiarioXmlBuilder } from './builders/resumen-diario-xml.builder';
import { FirmaService } from './firma/firma.service';
import { SunatSoapClient } from './sunat/sunat-soap.client';
import { CdrParserService } from './cdr/cdr-parser.service';
import { ZipService } from './zip/zip.service';
import {
  ComprobanteStorageService,
  LocalFileStorageProvider,
} from './storage/comprobante-storage.service';
import { PdfGeneratorService } from './pdf/pdf-generator.service';
import { EncryptionService } from '../../common/security/encryption.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

import { SunatSolBotService } from './sunat-sol/sunat-sol-bot.service';
import { SunatSolEmissionProvider } from './sunat-sol/sunat-sol-emission.provider';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [
    FacturacionController,
    ConfiguracionTributariaController,
    ResumenDiarioController,
  ],
  providers: [
    FacturacionService,
    ConfiguracionTributariaService,
    CorrelativosService,
    TributosCalculatorService,
    ComprobanteValidationService,
    ResumenDiarioService,
    VentaToComprobanteMapper,
    XmlBuilderService,
    ResumenDiarioXmlBuilder,
    FirmaService,
    SunatSoapClient,
    CdrParserService,
    ZipService,
    ComprobanteStorageService,
    LocalFileStorageProvider,
    PdfGeneratorService,
    EncryptionService,
    SunatSolBotService,
    SunatSolEmissionProvider,
  ],
  exports: [
    FacturacionService,
    ComprobanteStorageService,
    FirmaService,
    EncryptionService,
    SunatSolBotService,
    SunatSolEmissionProvider,
  ],
})
export class FacturacionModule {}
