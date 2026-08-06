import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { GlobalAuthGuard } from './auth/guards/global-auth.guard';
import { ProductosModule } from './modules/productos/productos.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { DiagnosticosModule } from './modules/diagnosticos/diagnosticos.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { FacturacionModule } from './modules/facturacion/facturacion.module';
import { AuditModule } from './modules/audit/audit.module';
import { EventsModule } from './socket/events.module';
import { ComprobantesPublicosModule } from './modules/comprobantes-publicos/comprobantes-publicos.module';
import { CajasModule } from './modules/cajas/cajas.module';
import { PosventaModule } from './modules/posventa/posventa.module';
import { GastosModule } from './modules/gastos/gastos.module';
import { SeriesDocumentosModule } from './modules/series-documentos/series-documentos.module';
import { AdministracionGeneralModule } from './modules/administracion-general/administracion-general.module';
import { ComprasModule } from './modules/compras/compras.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { ComprobantesImpresionModule } from './modules/comprobantes-impresion/comprobantes-impresion.module';
import { PrintingQzModule } from './modules/printing-qz/printing-qz.module';
import { QzSecurityModule } from './modules/qz-security/qz-security.module';

@Module({
  imports: [
    AuthModule,
    ProductsModule,
    PrismaModule,
    ProductosModule,
    UsuariosModule,
    DiagnosticosModule,
    CatalogosModule,
    VentasModule,
    DashboardModule,
    ClientesModule,
    ReportesModule,
    FacturacionModule,
    AuditModule,
    EventsModule,
    ComprobantesPublicosModule,
    CajasModule,
    PosventaModule,
    GastosModule,
    SeriesDocumentosModule,
    AdministracionGeneralModule,
    ComprasModule,
    ProveedoresModule,
    ComprobantesImpresionModule,
    PrintingQzModule,
    QzSecurityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
  ],
})
export class AppModule {}
