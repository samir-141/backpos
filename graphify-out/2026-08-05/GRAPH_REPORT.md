# Graph Report - pos-backend  (2026-08-05)

## Corpus Check
- 224 files · ~75,850 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1847 nodes · 3703 edges · 158 communities (83 shown, 75 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dc078f72`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Roles
- AdministracionGeneralService
- ComprasService
- catalogos.controller.ts
- CreateClienteDto
- ComprobanteSunatData
- ProveedoresService
- .procesarEnvio
- CreateVentaDto
- 20260729020102_init/migration.sql
- ComprobantePrintData
- CreateSerieDocumentoDto
- GuardarConfiguracionTributariaDto
- src/prisma/prisma.module.ts
- PrismaService
- gastos.controller.ts
- products.controller.ts
- tributos-calculator.service.ts
- QueryReportesDto
- ProductosController
- facturacion.module.ts
- EncryptionService
- CreateGastoDto
- producto.mapper.ts
- facturacion.service.ts
- EventsGateway
- compilerOptions
- auth.module.ts
- ventas.service.ts
- DashboardController
- xml-builder.service.ts
- RealtimeService
- cors.config.ts
- posventa.service.ts
- UsersService
- devDependencies
- SunatSoapClient
- CreateProductoDto
- productos.service.ts
- scripts
- SocketAuthService
- configuracion-tributaria.service.ts
- EscannerGateway
- cajas.module.ts
- resumen-diario-xml.builder.ts
- PrismaService
- ProductosService
- AppController
- administracion-general.module.ts
- DiagnosticosController
- public.vw_productos_pos
- QueryProductosDto
- producto-detalle.response.ts
- dependencies
- PlatformAdminGuard
- public.vw_productos_pos
- FirmaService
- public.vw_productos_pos
- exclude
- package.json
- nest-cli.json
- seed.js
- seed-demo.js
- seed-facturacion-electronica.js
- FindProductos
- botica.decorator.ts
- public.vw_productos_pos
- class-transformer
- class-validator
- dotenv
- eslint
- VentasService
- @eslint/js
- "comprobantes_electronicos"
- globals
- jest
- @nestjs/cli
- @nestjs/common
- @nestjs/config
- @nestjs/core
- @nestjs/jwt
- README.md
- @nestjs/platform-socket.io
- @nestjs/schematics
- @nestjs/swagger
- @nestjs/testing
- @nestjs/websockets
- passport-jwt
- pdfmake
- pg
- @prisma/adapter-pg
- @prisma/client
- reflect-metadata
- rxjs
- socket.io
- swagger-ui-express
- @types/adm-zip
- @types/qrcode
- @types/xmldom
- dashboard.service.ts
- xmlbuilder2
- xmldom
- source-map-support
- supertest
- @swc/core
- ts-loader
- ts-node
- tsconfig-paths
- ComprobantesPublicosController
- @types/jest
- @types/passport-jwt
- @types/pg
- typescript
- typescript-eslint
- proveedores.module.ts
- @nestjs/passport
- @nestjs/platform-express
- app.module.ts
- qrcode
- product.entity.ts
- main.ts
- Unicidad por botica y evidencia RLS
- prisma
- axios
- passport
- @types/express
- 20260729033000_gastos_operativos/migration.sql
- 20260730090000_comprobantes_publicos/migration.sql
- 20260801030000_detalle_venta_lotes/migration.sql
- 20260804010000_productos_correlativos/migration.sql
- public.detalles_ventas
- public.usuarios
- @types/pdfmake
- prettier
- PosventaModule
- public.categorias
- public.formas_farmaceuticas
- public.laboratorios
- public.lotes
- public.medicamentos
- public.principios_activos
- public.productos_comerciales
- public.productos_presentaciones
- public.unidades_presentacion
- "empresas"
- ApiResponse

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 75 edges
2. `Roles()` - 34 edges
3. `EventsGateway` - 31 edges
4. `"empresas"` - 31 edges
5. `"usuarios"` - 30 edges
6. `AdministracionGeneralService` - 24 edges
7. `PrismaModule` - 24 edges
8. `ComprasService` - 23 edges
9. `ComprobantePrintData` - 23 edges
10. `TenantGuard` - 23 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `createCorsOptions()`  [EXTRACTED]
  src/main.ts → src/common/config/cors.config.ts
- `CajasController` --references--> `Roles()`  [EXTRACTED]
  src/modules/cajas/cajas.controller.ts → src/auth/decorators/roles.decorator.ts
- `ComprasController` --references--> `Roles()`  [EXTRACTED]
  src/modules/compras/compras.controller.ts → src/auth/decorators/roles.decorator.ts
- `ProveedoresController` --references--> `Roles()`  [EXTRACTED]
  src/modules/proveedores/proveedores.controller.ts → src/auth/decorators/roles.decorator.ts
- `DetallePreparado` --references--> `CreateCompraDetalleDto`  [EXTRACTED]
  src/modules/compras/compras.service.ts → src/modules/compras/dto/compras.dto.ts

## Import Cycles
- None detected.

## Communities (158 total, 75 thin omitted)

### Community 0 - "Roles"
Cohesion: 0.05
Nodes (38): Put, IS_PUBLIC_KEY, Roles(), ROLES_KEY, RolesGuard, Injectable, TenantGuard, Injectable (+30 more)

### Community 1 - "AdministracionGeneralService"
Cohesion: 0.06
Nodes (40): ArrayUnique, AdministracionGeneralController, Body, Controller, Delete, Get, Param, Patch (+32 more)

### Community 2 - "ComprasService"
Cohesion: 0.05
Nodes (43): ArrayMaxSize, ComprasController, ApiTags, Body, Controller, Get, Headers, Param (+35 more)

### Community 3 - "catalogos.controller.ts"
Cohesion: 0.07
Nodes (43): ApiBearerAuth, ApiParam, Req, CatalogosController, ApiOperation, ApiResponse, ApiTags, Body (+35 more)

### Community 4 - "CreateClienteDto"
Cohesion: 0.06
Nodes (36): ClientesController, ApiOperation, ApiTags, Body, Controller, Delete, Get, HttpCode (+28 more)

### Community 5 - "ComprobanteSunatData"
Cohesion: 0.07
Nodes (28): ComprobantesImpresionController, ApiOperation, ApiTags, Body, Controller, Get, Param, Post (+20 more)

### Community 6 - "ProveedoresService"
Cohesion: 0.07
Nodes (31): CreateProveedorDto, QueryProveedoresDto, IsEmail, IsInt, IsOptional, IsString, Length, Matches (+23 more)

### Community 7 - ".procesarEnvio"
Cohesion: 0.06
Nodes (33): RequestAutenticada, FacturacionController, ApiOperation, ApiTags, Body, Controller, Get, Headers (+25 more)

### Community 8 - "CreateVentaDto"
Cohesion: 0.10
Nodes (29): CreateVentaDto, DatosClienteDto, DetalleVentaItemDto, ApiProperty, ApiPropertyOptional, ArrayMinSize, IsArray, IsInt (+21 more)

### Community 9 - "20260729020102_init/migration.sql"
Cohesion: 0.24
Nodes (31): "cajas", "categorias", "clientes", "compras", "detalles_compras", "detalles_ventas", "empresas", "formas_farmaceuticas" (+23 more)

### Community 10 - "ComprobantePrintData"
Cohesion: 0.14
Nodes (12): ComprobantePagoData, ComprobantePrintData, A4Template, fmt(), TIPOS_COMPROBANTE, ComprobanteTemplate, fmt(), Ticket58Template (+4 more)

### Community 11 - "CreateSerieDocumentoDto"
Cohesion: 0.08
Nodes (28): CreateSerieDocumentoDto, ApiProperty, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID (+20 more)

### Community 12 - "GuardarConfiguracionTributariaDto"
Cohesion: 0.08
Nodes (27): ApiConsumes, ConfiguracionTributariaController, ApiOperation, ApiTags, Body, Controller, Get, Patch (+19 more)

### Community 13 - "src/prisma/prisma.module.ts"
Cohesion: 0.14
Nodes (14): AuditModule, Global, Module, ComprobantesImpresionModule, Module, ComprobantesPublicosModule, Module, DashboardModule (+6 more)

### Community 14 - "PrismaService"
Cohesion: 0.14
Nodes (7): JwtStrategy, Injectable, PrismaService, Injectable, TestController, Controller, Get

### Community 15 - "gastos.controller.ts"
Cohesion: 0.11
Nodes (14): GastosAdminGuard, GastosController, Controller, Delete, Get, Injectable, Param, Query (+6 more)

### Community 16 - "products.controller.ts"
Cohesion: 0.11
Nodes (13): CreateProductDto, UpdateProductDto, ProductsController, Body, Controller, Delete, Get, Param (+5 more)

### Community 17 - "tributos-calculator.service.ts"
Cohesion: 0.12
Nodes (20): ClienteComprobanteData, ComprobanteItemData, DocumentoComprobanteData, nombreArchivoComprobante(), TotalesComprobanteData, Injectable, VentaToComprobanteMapper, ContextoEmision (+12 more)

### Community 18 - "QueryReportesDto"
Cohesion: 0.13
Nodes (16): QueryReportesDto, ApiPropertyOptional, IsOptional, IsString, IsUUID, ReportesController, ApiOperation, ApiTags (+8 more)

### Community 19 - "ProductosController"
Cohesion: 0.17
Nodes (15): ProductosController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Headers (+7 more)

### Community 20 - "facturacion.module.ts"
Cohesion: 0.23
Nodes (6): CdrParserService, ResultadoCdr, Injectable, EstadoComprobante, Injectable, ZipService

### Community 21 - "EncryptionService"
Cohesion: 0.12
Nodes (7): EncryptionService, Injectable, EXTENSIONES_CERTIFICADO, fmtFecha(), ResumenDiarioService, soloFecha(), Injectable

### Community 22 - "CreateGastoDto"
Cohesion: 0.17
Nodes (11): CreateGastoDto, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min (+3 more)

### Community 23 - "producto.mapper.ts"
Cohesion: 0.13
Nodes (17): IdNombre, LoteEntrada, MedicamentoEntrada, NumericValue, PresentacionEntrada, ProductoDetalleEntrada, ProductoListaCamposExtendidos, ProductoListaFila (+9 more)

### Community 24 - "facturacion.service.ts"
Cohesion: 0.09
Nodes (21): LogAuditParams, ESTADOS_REINTENTABLES, EmitirComprobanteDto, ApiProperty, IsIn, IsUUID, ComprobanteValidationService, Injectable (+13 more)

### Community 25 - "EventsGateway"
Cohesion: 0.15
Nodes (9): EventsGateway, ConnectedSocket, Injectable, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, UserConnectionInfo (+1 more)

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, ignoreDeprecations (+13 more)

### Community 27 - "auth.module.ts"
Cohesion: 0.14
Nodes (11): AuthController, Body, Controller, HttpCode, Post, AuthService, Injectable, LoginDto (+3 more)

### Community 28 - "ventas.service.ts"
Cohesion: 0.17
Nodes (9): AuditService, Injectable, ComprobantesPublicosService, hashesCoinciden(), hashSnapshot(), serializarSnapshot(), setup(), Injectable (+1 more)

### Community 29 - "DashboardController"
Cohesion: 0.14
Nodes (11): DashboardController, ApiOperation, ApiTags, Controller, Get, Headers, Query, Request (+3 more)

### Community 30 - "xml-builder.service.ts"
Cohesion: 0.15
Nodes (14): esExonerado(), esGravado(), esquemaTributario(), fmt(), fmtFecha(), fmtHora(), NS, Injectable (+6 more)

### Community 31 - "RealtimeService"
Cohesion: 0.08
Nodes (26): CajasController, ApiOperation, ApiTags, Body, Controller, Get, Headers, HttpCode (+18 more)

### Community 32 - "cors.config.ts"
Cohesion: 0.25
Nodes (10): CORS_METHODS, CorsEnvironment, createCorsOptions(), HTTP_PROTOCOLS, isCorsOriginAllowed(), isDevelopmentOrigin(), isPrivateIpv4(), normalizeOrigin() (+2 more)

### Community 33 - "posventa.service.ts"
Cohesion: 0.11
Nodes (18): CreateCambioDto, CreateDevolucionDto, CreateGarantiaDto, CreateReclamoDto, PosventaController, ApiOperation, ApiTags, Body (+10 more)

### Community 34 - "UsersService"
Cohesion: 0.16
Nodes (9): Controller, Get, Param, UseGuards, UsersController, Module, UsersModule, Injectable (+1 more)

### Community 35 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint-config-prettier, @eslint/eslintrc, eslint-plugin-prettier, devDependencies, eslint-config-prettier, @eslint/eslintrc, eslint-plugin-prettier, @swc/cli (+9 more)

### Community 36 - "SunatSoapClient"
Cohesion: 0.21
Nodes (8): CredencialesSol, ENDPOINTS, escapeXml(), SunatSendBillResult, SunatSoapClient, SunatStatusResult, SunatTicketResult, Injectable

### Community 37 - "CreateProductoDto"
Cohesion: 0.17
Nodes (16): CreateProductoDto, PresentacionProductoDto, ApiProperty, ApiPropertyOptional, IsArray, IsBoolean, IsInt, IsNotEmpty (+8 more)

### Community 38 - "productos.service.ts"
Cohesion: 0.13
Nodes (12): OrdenProductos, ApiPropertyOptional, IsBoolean, IsNumber, IsOptional, IsString, Min, Type (+4 more)

### Community 39 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, build, db:seed, db:seed-demo, format, lint, render:build, start (+8 more)

### Community 41 - "configuracion-tributaria.service.ts"
Cohesion: 0.21
Nodes (11): AmbienteSunat, FormaPago, RegimenTributario, UnidadMedidaSunat, comprobantesPermitidos(), errorCoherenciaRucRegimen(), motivoBloqueoEmision(), NOMBRES_REGIMEN (+3 more)

### Community 42 - "EscannerGateway"
Cohesion: 0.28
Nodes (6): EscannerGateway, ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 43 - "cajas.module.ts"
Cohesion: 0.33
Nodes (5): CajasModule, Module, EventsModule, Global, Module

### Community 44 - "resumen-diario-xml.builder.ts"
Cohesion: 0.25
Nodes (7): DatosResumenDiario, fmt(), fmtFecha(), LineaResumenDiario, ResumenDiarioXmlBuilder, Injectable, EmisorData

### Community 45 - "PrismaService"
Cohesion: 0.20
Nodes (5): PrismaModule, Global, Module, PrismaService, Injectable

### Community 46 - "ProductosService"
Cohesion: 0.19
Nodes (3): dtoBase, ProductosService, Injectable

### Community 47 - "AppController"
Cohesion: 0.22
Nodes (6): AppController, ApiTags, Controller, Get, AppService, Injectable

### Community 48 - "administracion-general.module.ts"
Cohesion: 0.18
Nodes (8): AuthModule, Module, AdministracionGeneralModule, Module, DiagnosticosModule, Module, ProductsModule, Module

### Community 49 - "DiagnosticosController"
Cohesion: 0.23
Nodes (7): ApiResponse, DiagnosticosController, ApiOperation, ApiTags, Controller, Get, UseGuards

### Community 50 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 51 - "QueryProductosDto"
Cohesion: 0.20
Nodes (10): QueryProductosDto, ApiPropertyOptional, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max (+2 more)

### Community 52 - "producto-detalle.response.ts"
Cohesion: 0.36
Nodes (9): CategoriaResponse, FormaFarmaceuticaResponse, LaboratorioResponse, LoteProductoResponse, MedicamentoResponse, PresentacionResponse, PrincipioActivoResponse, ApiProperty (+1 more)

### Community 53 - "dependencies"
Cohesion: 0.22
Nodes (9): adm-zip, bcrypt, fast-xml-parser, dependencies, adm-zip, bcrypt, fast-xml-parser, xml-crypto (+1 more)

### Community 55 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 56 - "FirmaService"
Cohesion: 0.29
Nodes (4): CertificadoExtraido, FirmaService, ResultadoFirma, Injectable

### Community 57 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 58 - "exclude"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 59 - "package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 60 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, builder, $schema, sourceRoot

### Community 61 - "seed.js"
Cohesion: 0.40
Nodes (5): bcrypt, cfg, { Client }, main(), one()

### Community 62 - "seed-demo.js"
Cohesion: 0.70
Nodes (4): { Client }, ensure(), main(), one()

### Community 63 - "seed-facturacion-electronica.js"
Cohesion: 0.70
Nodes (4): { Client }, main(), one(), SERIES

### Community 64 - "FindProductos"
Cohesion: 0.50
Nodes (3): FindProductos, IsOptional, IsString

### Community 66 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 73 - ""comprobantes_electronicos""
Cohesion: 0.29
Nodes (11): "clientes", "comprobantes_electronicos", "comprobantes_electronicos_detalles", "comprobantes_intentos_envio", "configuraciones_tributarias", "resumenes_diarios", "resumenes_diarios_detalles", "empresas" (+3 more)

### Community 81 - "README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 99 - "dashboard.service.ts"
Cohesion: 0.40
Nodes (4): DashboardQueryDto, ApiPropertyOptional, IsOptional, IsString

### Community 108 - "ComprobantesPublicosController"
Cohesion: 0.24
Nodes (6): ComprobantesPublicosController, Controller, Get, Param, Request, UseGuards

### Community 117 - "app.module.ts"
Cohesion: 0.12
Nodes (14): CatalogosModule, Module, ClientesModule, Module, ComprasModule, Module, FacturacionModule, Module (+6 more)

### Community 123 - "main.ts"
Cohesion: 0.29
Nodes (5): Catch, AppModule, Module, HttpExceptionFilter, bootstrap()

### Community 124 - "Unicidad por botica y evidencia RLS"
Cohesion: 0.29
Nodes (6): Alcance, Alineación de la aplicación, Evidencia de reglas de negocio, Preflight y despliegue, RLS, Unicidad por botica y evidencia RLS

## Knowledge Gaps
- **201 isolated node(s):** `Alcance`, `Evidencia de reglas de negocio`, `Preflight y despliegue`, `RLS`, `Alineación de la aplicación` (+196 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **75 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `Roles`, `AdministracionGeneralService`, `ComprasService`, `catalogos.controller.ts`, `CreateClienteDto`, `ComprobanteSunatData`, `ProveedoresService`, `ComprobantePrintData`, `CreateSerieDocumentoDto`, `GuardarConfiguracionTributariaDto`, `src/prisma/prisma.module.ts`, `gastos.controller.ts`, `products.controller.ts`, `QueryReportesDto`, `facturacion.module.ts`, `facturacion.service.ts`, `EventsGateway`, `auth.module.ts`, `ventas.service.ts`, `DashboardController`, `RealtimeService`, `posventa.service.ts`, `UsersService`, `productos.service.ts`, `SocketAuthService`, `configuracion-tributaria.service.ts`, `resumen-diario-xml.builder.ts`, `PlatformAdminGuard`, `dashboard.service.ts`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Why does `Roles()` connect `Roles` to `ComprasService`, `catalogos.controller.ts`, `productos.service.ts`, `.procesarEnvio`, `ProveedoresService`, `CreateVentaDto`, `GuardarConfiguracionTributariaDto`, `ProductosController`, `RealtimeService`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `"roles"` connect `20260729020102_init/migration.sql` to `catalogos.controller.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `Alcance`, `Evidencia de reglas de negocio`, `Preflight y despliegue` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Roles` be split into smaller, more focused modules?**
  _Cohesion score 0.05393000573723465 - nodes in this community are weakly interconnected._
- **Should `AdministracionGeneralService` be split into smaller, more focused modules?**
  _Cohesion score 0.06127206127206127 - nodes in this community are weakly interconnected._
- **Should `ComprasService` be split into smaller, more focused modules?**
  _Cohesion score 0.05328218243819267 - nodes in this community are weakly interconnected._