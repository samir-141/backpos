import { Module } from '@nestjs/common';
import { FacturacionController } from './controllers/facturacion.controller';
import { FacturacionService } from './services/facturacion.service';
import { XmlBuilderService } from './builders/xml-builder.service';
import { FirmaService } from './firma/firma.service';
import { SunatSoapService } from './sunat/sunat-soap.service';
import { PdfGeneratorService } from './pdf/pdf-generator.service';
import { FacturacionValidator } from './validators/facturacion.validator';

@Module({
  controllers: [FacturacionController],
  providers: [
    FacturacionService,
    XmlBuilderService,
    FirmaService,
    SunatSoapService,
    PdfGeneratorService,
    FacturacionValidator,
  ],
  exports: [FacturacionService],
})
export class FacturacionModule {}
