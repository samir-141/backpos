import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
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
  ],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule {}
