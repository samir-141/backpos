# Graph Report - pos-backend  (2026-08-04)

## Corpus Check
- 224 files · ~75,798 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1831 nodes · 3784 edges · 144 communities (81 shown, 63 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9d66c935`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TenantGuard
- AdministracionGeneralService
- ComprasService
- catalogos.controller.ts
- CreateClienteDto
- ComprobantesImpresionService
- ProveedoresService
- .procesarEnvio
- VentasService
- "empresas"
- ComprobantePrintData
- CreateSerieDocumentoDto
- "roles"
- app.module.ts
- PrismaService
- CreateGastoDto
- ProductsService
- tributos-calculator.service.ts
- QueryReportesDto
- ProductosController
- facturacion.service.ts
- ResumenDiarioService
- ComprobanteSunatData
- producto.mapper.ts
- comprobante-validation.service.ts
- EventsGateway
- compilerOptions
- auth.module.ts
- AuditService
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
- events.gateway.ts
- emision-permitida.domain.ts
- EscannerGateway
- posventa.module.ts
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
- facturacion.module.ts
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
- @eslint/eslintrc
- @eslint/js
- fast-xml-parser
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
- xml-crypto
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
- pdf-generator.service.ts
- A4Template
- Ticket58Template
- FacturacionModule
- Ticket80Template
- product.entity.ts
- main.ts
- Unicidad por botica y evidencia RLS
- prisma
- bcrypt
- passport
- prettier
- 20260729033000_gastos_operativos/migration.sql
- 20260730090000_comprobantes_publicos/migration.sql
- 20260801030000_detalle_venta_lotes/migration.sql
- 20260804010000_productos_correlativos/migration.sql
- public.detalles_ventas
- public.usuarios

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 75 edges
2. `"empresas"` - 34 edges
3. `"roles"` - 31 edges
4. `EventsGateway` - 31 edges
5. `"usuarios"` - 30 edges
6. `AdministracionGeneralService` - 25 edges
7. `PrismaModule` - 24 edges
8. `TenantGuard` - 23 edges
9. `ComprasService` - 23 edges
10. `ComprobantePrintData` - 23 edges

## Surprising Connections (you probably didn't know these)
- `zipDe()` --references--> `adm-zip`  [EXTRACTED]
  src/modules/facturacion/tests/cdr-parser.spec.ts → package.json
- `CajasController` --references--> `"roles"`  [EXTRACTED]
  src/modules/cajas/cajas.controller.ts → prisma/migrations/20260729020102_init/migration.sql
- `ComprasController` --references--> `"roles"`  [EXTRACTED]
  src/modules/compras/compras.controller.ts → prisma/migrations/20260729020102_init/migration.sql
- `ProveedoresController` --references--> `"roles"`  [EXTRACTED]
  src/modules/proveedores/proveedores.controller.ts → prisma/migrations/20260729020102_init/migration.sql
- `bootstrap()` --calls--> `createCorsOptions()`  [EXTRACTED]
  src/main.ts → src/common/config/cors.config.ts

## Import Cycles
- None detected.

## Communities (144 total, 63 thin omitted)

### Community 0 - "TenantGuard"
Cohesion: 0.05
Nodes (46): IS_PUBLIC_KEY, Roles(), ROLES_KEY, RolesGuard, Injectable, TenantGuard, Injectable, CajasController (+38 more)

### Community 1 - "AdministracionGeneralService"
Cohesion: 0.07
Nodes (40): ArrayUnique, AdministracionGeneralController, Body, Controller, Delete, Get, Param, Patch (+32 more)

### Community 2 - "ComprasService"
Cohesion: 0.05
Nodes (44): ArrayMaxSize, ComprasController, TenantRequest, ApiTags, Body, Controller, Get, Headers (+36 more)

### Community 3 - "catalogos.controller.ts"
Cohesion: 0.07
Nodes (43): ApiBearerAuth, ApiParam, Req, CatalogosController, ApiOperation, ApiResponse, ApiTags, Body (+35 more)

### Community 4 - "CreateClienteDto"
Cohesion: 0.06
Nodes (38): ClientesController, ApiOperation, ApiTags, Body, Controller, Delete, Get, HttpCode (+30 more)

### Community 5 - "ComprobantesImpresionService"
Cohesion: 0.09
Nodes (20): qrcode, qrcode, ComprobantesImpresionController, ApiOperation, ApiTags, Body, Controller, Get (+12 more)

### Community 6 - "ProveedoresService"
Cohesion: 0.07
Nodes (34): CreateProveedorDto, QueryProveedoresDto, IsEmail, IsInt, IsOptional, IsString, Length, Matches (+26 more)

### Community 7 - ".procesarEnvio"
Cohesion: 0.06
Nodes (33): RequestAutenticada, FacturacionController, ApiOperation, ApiTags, Body, Controller, Get, Headers (+25 more)

### Community 8 - "VentasService"
Cohesion: 0.07
Nodes (31): CreateVentaDto, DatosClienteDto, DetalleVentaItemDto, ApiProperty, ApiPropertyOptional, ArrayMinSize, IsArray, IsInt (+23 more)

### Community 9 - ""empresas""
Cohesion: 0.19
Nodes (36): "cajas", "categorias", "clientes", "compras", "detalles_compras", "detalles_ventas", "empresas", "formas_farmaceuticas" (+28 more)

### Community 10 - "ComprobantePrintData"
Cohesion: 0.36
Nodes (6): ComprobantePagoData, ComprobantePrintData, TIPOS_COMPROBANTE, ComprobanteTemplate, TIPOS_COMPROBANTE, TIPOS_COMPROBANTE

### Community 11 - "CreateSerieDocumentoDto"
Cohesion: 0.08
Nodes (28): CreateSerieDocumentoDto, ApiProperty, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID (+20 more)

### Community 12 - ""roles""
Cohesion: 0.05
Nodes (44): ApiConsumes, "roles", Put, ConfiguracionTributariaController, ApiOperation, ApiTags, Body, Controller (+36 more)

### Community 13 - "app.module.ts"
Cohesion: 0.11
Nodes (23): CatalogosModule, Module, ComprasModule, Module, ComprobantesImpresionModule, Module, ComprobantesPublicosModule, Module (+15 more)

### Community 14 - "PrismaService"
Cohesion: 0.13
Nodes (7): JwtStrategy, Injectable, PrismaService, Injectable, TestController, Controller, Get

### Community 15 - "CreateGastoDto"
Cohesion: 0.08
Nodes (23): CreateGastoDto, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min (+15 more)

### Community 16 - "ProductsService"
Cohesion: 0.12
Nodes (15): CreateProductDto, UpdateProductDto, ProductsController, Body, Controller, Delete, Get, Param (+7 more)

### Community 17 - "tributos-calculator.service.ts"
Cohesion: 0.09
Nodes (24): FormaPago, RegimenTributario, UnidadMedidaSunat, ClienteComprobanteData, ComprobanteItemData, DocumentoComprobanteData, nombreArchivoComprobante(), TotalesComprobanteData (+16 more)

### Community 18 - "QueryReportesDto"
Cohesion: 0.15
Nodes (16): QueryReportesDto, ApiPropertyOptional, IsOptional, IsString, IsUUID, ReportesController, ApiOperation, ApiTags (+8 more)

### Community 19 - "ProductosController"
Cohesion: 0.17
Nodes (15): ProductosController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Headers (+7 more)

### Community 20 - "facturacion.service.ts"
Cohesion: 0.17
Nodes (11): adm-zip, adm-zip, CdrParserService, ResultadoCdr, Injectable, EstadoComprobante, ESTADOS_REINTENTABLES, ComprobanteConDetalles (+3 more)

### Community 21 - "ResumenDiarioService"
Cohesion: 0.23
Nodes (4): fmtFecha(), ResumenDiarioService, soloFecha(), Injectable

### Community 22 - "ComprobanteSunatData"
Cohesion: 0.41
Nodes (4): ComprobanteSunatData, fmt(), PdfGeneratorService, Injectable

### Community 23 - "producto.mapper.ts"
Cohesion: 0.14
Nodes (17): IdNombre, LoteEntrada, MedicamentoEntrada, NumericValue, PresentacionEntrada, ProductoDetalleEntrada, ProductoListaCamposExtendidos, ProductoListaFila (+9 more)

### Community 24 - "comprobante-validation.service.ts"
Cohesion: 0.10
Nodes (18): EmitirComprobanteDto, ApiProperty, IsIn, IsUUID, ComprobanteValidationService, Injectable, VentaEmision, CorrelativoReservado (+10 more)

### Community 25 - "EventsGateway"
Cohesion: 0.18
Nodes (7): EventsGateway, ConnectedSocket, Injectable, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, ignoreDeprecations (+13 more)

### Community 27 - "auth.module.ts"
Cohesion: 0.14
Nodes (11): AuthController, Body, Controller, HttpCode, Post, AuthService, Injectable, LoginDto (+3 more)

### Community 28 - "AuditService"
Cohesion: 0.16
Nodes (10): AuditService, LogAuditParams, Injectable, ComprobantesPublicosService, hashesCoinciden(), hashSnapshot(), serializarSnapshot(), setup() (+2 more)

### Community 29 - "DashboardController"
Cohesion: 0.11
Nodes (15): DashboardController, ApiOperation, ApiTags, Controller, Get, Headers, Query, Request (+7 more)

### Community 30 - "xml-builder.service.ts"
Cohesion: 0.16
Nodes (13): esExonerado(), esGravado(), esquemaTributario(), fmt(), fmtFecha(), fmtHora(), NS, Injectable (+5 more)

### Community 31 - "RealtimeService"
Cohesion: 0.17
Nodes (3): dto, RealtimeService, Injectable

### Community 32 - "cors.config.ts"
Cohesion: 0.25
Nodes (10): CORS_METHODS, CorsEnvironment, createCorsOptions(), HTTP_PROTOCOLS, isCorsOriginAllowed(), isDevelopmentOrigin(), isPrivateIpv4(), normalizeOrigin() (+2 more)

### Community 33 - "posventa.service.ts"
Cohesion: 0.12
Nodes (18): CreateCambioDto, CreateDevolucionDto, CreateGarantiaDto, CreateReclamoDto, PosventaController, ApiOperation, ApiTags, Body (+10 more)

### Community 34 - "UsersService"
Cohesion: 0.16
Nodes (9): Controller, Get, Param, UseGuards, UsersController, Module, UsersModule, Injectable (+1 more)

### Community 35 - "devDependencies"
Cohesion: 0.12
Nodes (17): eslint-config-prettier, eslint-plugin-prettier, devDependencies, eslint-config-prettier, eslint-plugin-prettier, @swc/cli, ts-jest, @types/bcrypt (+9 more)

### Community 36 - "SunatSoapClient"
Cohesion: 0.19
Nodes (9): AmbienteSunat, CredencialesSol, ENDPOINTS, escapeXml(), SunatSendBillResult, SunatSoapClient, SunatStatusResult, SunatTicketResult (+1 more)

### Community 37 - "CreateProductoDto"
Cohesion: 0.17
Nodes (16): CreateProductoDto, PresentacionProductoDto, ApiProperty, ApiPropertyOptional, IsArray, IsBoolean, IsInt, IsNotEmpty (+8 more)

### Community 38 - "productos.service.ts"
Cohesion: 0.13
Nodes (10): OrdenProductos, ApiPropertyOptional, IsBoolean, IsNumber, IsOptional, IsString, Min, Type (+2 more)

### Community 39 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, build, db:seed, db:seed-demo, format, lint, render:build, start (+8 more)

### Community 40 - "events.gateway.ts"
Cohesion: 0.16
Nodes (4): UserConnectionInfo, SocketAuthService, SocketUser, Injectable

### Community 41 - "emision-permitida.domain.ts"
Cohesion: 0.42
Nodes (7): comprobantesPermitidos(), errorCoherenciaRucRegimen(), motivoBloqueoEmision(), NOMBRES_REGIMEN, NOMBRES_TIPO, PERMISOS_POR_REGIMEN, puedeEmitir()

### Community 42 - "EscannerGateway"
Cohesion: 0.28
Nodes (6): EscannerGateway, ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 43 - "posventa.module.ts"
Cohesion: 0.18
Nodes (10): AuditModule, Global, Module, CajasModule, Module, PosventaModule, Module, EventsModule (+2 more)

### Community 44 - "resumen-diario-xml.builder.ts"
Cohesion: 0.25
Nodes (7): DatosResumenDiario, fmt(), fmtFecha(), LineaResumenDiario, ResumenDiarioXmlBuilder, Injectable, EmisorData

### Community 45 - "PrismaService"
Cohesion: 0.20
Nodes (5): PrismaModule, Global, Module, PrismaService, Injectable

### Community 47 - "AppController"
Cohesion: 0.22
Nodes (6): AppController, ApiTags, Controller, Get, AppService, Injectable

### Community 48 - "administracion-general.module.ts"
Cohesion: 0.25
Nodes (6): AuthModule, Module, AdministracionGeneralModule, Module, DiagnosticosModule, Module

### Community 49 - "DiagnosticosController"
Cohesion: 0.23
Nodes (7): DiagnosticosController, ApiOperation, ApiResponse, ApiTags, Controller, Get, UseGuards

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
Nodes (9): axios, @nestjs/passport, @nestjs/platform-express, dependencies, axios, @nestjs/passport, @nestjs/platform-express, @types/pdfmake (+1 more)

### Community 55 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 56 - "facturacion.module.ts"
Cohesion: 0.16
Nodes (7): EncryptionService, Injectable, CertificadoExtraido, FirmaService, ResultadoFirma, Injectable, EXTENSIONES_CERTIFICADO

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
Cohesion: 0.50
Nodes (4): { Client }, main(), one(), SERIES

### Community 64 - "FindProductos"
Cohesion: 0.50
Nodes (3): FindProductos, IsOptional, IsString

### Community 66 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 81 - "README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 108 - "ComprobantesPublicosController"
Cohesion: 0.24
Nodes (6): ComprobantesPublicosController, Controller, Get, Param, Request, UseGuards

### Community 114 - "pdf-generator.service.ts"
Cohesion: 0.24
Nodes (6): ExtrasPdf, fontsPdfmake(), FormatoPdf, PdfKitStream, PdfPrinterCtor, TIPOS_COMPROBANTE

### Community 123 - "main.ts"
Cohesion: 0.29
Nodes (5): Catch, AppModule, Module, HttpExceptionFilter, bootstrap()

### Community 124 - "Unicidad por botica y evidencia RLS"
Cohesion: 0.29
Nodes (6): Alcance, Alineación de la aplicación, Evidencia de reglas de negocio, Preflight y despliegue, RLS, Unicidad por botica y evidencia RLS

## Knowledge Gaps
- **202 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `builder`, `name` (+197 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **63 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `TenantGuard`, `AdministracionGeneralService`, `ComprasService`, `catalogos.controller.ts`, `CreateClienteDto`, `ComprobantesImpresionService`, `ProveedoresService`, `ComprobantePrintData`, `CreateSerieDocumentoDto`, `"roles"`, `app.module.ts`, `CreateGastoDto`, `ProductsService`, `QueryReportesDto`, `facturacion.service.ts`, `comprobante-validation.service.ts`, `auth.module.ts`, `AuditService`, `DashboardController`, `RealtimeService`, `posventa.service.ts`, `UsersService`, `productos.service.ts`, `events.gateway.ts`, `resumen-diario-xml.builder.ts`, `PlatformAdminGuard`, `facturacion.module.ts`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `passport`, `ComprobantesImpresionService`, `facturacion.service.ts`, `package.json`, `class-transformer`, `class-validator`, `dotenv`, `fast-xml-parser`, `@nestjs/common`, `@nestjs/config`, `@nestjs/core`, `@nestjs/jwt`, `@nestjs/platform-socket.io`, `@nestjs/swagger`, `@nestjs/websockets`, `passport-jwt`, `pdfmake`, `pg`, `@prisma/adapter-pg`, `@prisma/client`, `reflect-metadata`, `rxjs`, `socket.io`, `swagger-ui-express`, `@types/adm-zip`, `@types/qrcode`, `@types/xmldom`, `xml-crypto`, `xmlbuilder2`, `xmldom`, `prisma`, `bcrypt`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Why does `"roles"` connect `"roles"` to `TenantGuard`, `ComprasService`, `catalogos.controller.ts`, `ProveedoresService`, `.procesarEnvio`, `VentasService`, `"empresas"`, `ProductosController`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _202 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TenantGuard` be split into smaller, more focused modules?**
  _Cohesion score 0.051462904911180773 - nodes in this community are weakly interconnected._
- **Should `AdministracionGeneralService` be split into smaller, more focused modules?**
  _Cohesion score 0.06593406593406594 - nodes in this community are weakly interconnected._
- **Should `ComprasService` be split into smaller, more focused modules?**
  _Cohesion score 0.05311871227364185 - nodes in this community are weakly interconnected._