# Graph Report - pos-backend  (2026-08-05)

## Corpus Check
- 231 files · ~77,221 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1910 nodes · 3750 edges · 174 communities (83 shown, 91 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b25ed98`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ApiOperation
- AdministracionGeneralService
- ComprasService
- catalogos.controller.ts
- CreateClienteDto
- PdfGeneratorService
- ProveedoresService
- RequestAutenticada
- CreateVentaDto
- 20260729020102_init/migration.sql
- ComprobantePrintData
- CreateSerieDocumentoDto
- UsuariosController
- app.module.ts
- PrismaService
- gastos.controller.ts
- products.controller.ts
- comprobante-validation.service.ts
- QueryReportesDto
- ProductosService
- facturacion.module.ts
- ResumenDiarioService
- Roles
- producto.mapper.ts
- comprobante-validation.spec.ts
- .create
- compilerOptions
- auth.module.ts
- ventas.service.ts
- dashboard.module.ts
- FacturacionService
- RealtimeService
- EscannerGateway
- EventsGateway
- UsersService
- devDependencies
- SunatSoapClient
- CreateProductoDto
- UpdateProductoDto
- scripts
- CatalogosService
- configuracion-tributaria.service.ts
- .procesarEnvio
- posventa.module.ts
- resumen-diario-xml.builder.ts
- PrismaService
- PlatformAdminGuard
- AppController
- administracion-general.module.ts
- CreateUsuarioDto
- public.vw_productos_pos
- QueryProductosDto
- producto-detalle.response.ts
- dependencies
- .constructor
- public.vw_productos_pos
- productos.service.ts
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
- QzSecurityService
- dotenv
- eslint
- VentasService
- @eslint/js
- "comprobantes_electronicos"
- globals
- EncryptionService
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
- generate-qz-dev-cert.ts
- xmlbuilder2
- xmldom
- source-map-support
- supertest
- @swc/core
- ts-loader
- GastosAdminGuard
- tsconfig-paths
- ComprobantesPublicosService
- @types/jest
- @types/passport-jwt
- @types/pg
- numero-a-letras.util.ts
- typescript-eslint
- bcrypt
- @nestjs/passport
- fast-xml-parser
- FacturacionModule
- node-forge
- product.entity.ts
- xml-crypto
- Unicidad por botica y evidencia RLS
- prisma
- ts-jest
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
- @types/node
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
- @types/supertest
- GenerarResumenDto
- CreateGastoDto
- dashboard.service.ts
- ApiTags
- Body
- Controller
- Delete
- Get
- HttpCode
- Param
- Patch
- Post
- Request
- UseGuards
- Injectable

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 70 edges
2. `EventsGateway` - 31 edges
3. `"empresas"` - 31 edges
4. `"usuarios"` - 30 edges
5. `Roles()` - 29 edges
6. `AdministracionGeneralService` - 24 edges
7. `PrismaModule` - 24 edges
8. `ComprasService` - 23 edges
9. `TenantGuard` - 23 edges
10. `ProductosService` - 21 edges

## Surprising Connections (you probably didn't know these)
- `CajasController` --references--> `Roles()`  [EXTRACTED]
  src/modules/cajas/cajas.controller.ts → src/auth/decorators/roles.decorator.ts
- `ComprasController` --references--> `Roles()`  [EXTRACTED]
  src/modules/compras/compras.controller.ts → src/auth/decorators/roles.decorator.ts
- `ProveedoresController` --references--> `Roles()`  [EXTRACTED]
  src/modules/proveedores/proveedores.controller.ts → src/auth/decorators/roles.decorator.ts
- `bootstrap()` --calls--> `createCorsOptions()`  [EXTRACTED]
  src/main.ts → src/common/config/cors.config.ts
- `DetallePreparado` --references--> `CreateCompraDetalleDto`  [EXTRACTED]
  src/modules/compras/compras.service.ts → src/modules/compras/dto/compras.dto.ts

## Import Cycles
- None detected.

## Communities (174 total, 91 thin omitted)

### Community 1 - "AdministracionGeneralService"
Cohesion: 0.06
Nodes (40): ArrayUnique, AdministracionGeneralController, Body, Controller, Delete, Get, Param, Patch (+32 more)

### Community 2 - "ComprasService"
Cohesion: 0.05
Nodes (43): ArrayMaxSize, ComprasController, ApiTags, Body, Controller, Get, Headers, Param (+35 more)

### Community 3 - "catalogos.controller.ts"
Cohesion: 0.11
Nodes (24): CampoEspecial, CatalogoConfig, CATALOGOS_CONFIG, TipoCatalogo, TIPOS_CATALOGO, CreateCatalogoDto, ApiProperty, ApiPropertyOptional (+16 more)

### Community 4 - "CreateClienteDto"
Cohesion: 0.06
Nodes (38): ClientesController, ApiOperation, ApiTags, Body, Controller, Delete, Get, HttpCode (+30 more)

### Community 5 - "PdfGeneratorService"
Cohesion: 0.06
Nodes (29): qrcode, qrcode, ComprobantesImpresionController, ApiOperation, ApiTags, Body, Controller, Get (+21 more)

### Community 6 - "ProveedoresService"
Cohesion: 0.07
Nodes (31): CreateProveedorDto, QueryProveedoresDto, IsEmail, IsInt, IsOptional, IsString, Length, Matches (+23 more)

### Community 7 - "RequestAutenticada"
Cohesion: 0.05
Nodes (53): ApiConsumes, RequestAutenticada, ConfiguracionTributariaController, ApiOperation, ApiTags, Body, Controller, Get (+45 more)

### Community 8 - "CreateVentaDto"
Cohesion: 0.10
Nodes (29): CreateVentaDto, DatosClienteDto, DetalleVentaItemDto, ApiProperty, ApiPropertyOptional, ArrayMinSize, IsArray, IsInt (+21 more)

### Community 9 - "20260729020102_init/migration.sql"
Cohesion: 0.24
Nodes (31): "cajas", "categorias", "clientes", "compras", "detalles_compras", "detalles_ventas", "empresas", "formas_farmaceuticas" (+23 more)

### Community 10 - "ComprobantePrintData"
Cohesion: 0.11
Nodes (12): ComprobantePagoData, ComprobantePrintData, A4Template, fmt(), TIPOS_COMPROBANTE, ComprobanteTemplate, fmt(), Ticket58Template (+4 more)

### Community 11 - "CreateSerieDocumentoDto"
Cohesion: 0.08
Nodes (26): CreateSerieDocumentoDto, ApiProperty, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID (+18 more)

### Community 12 - "UsuariosController"
Cohesion: 0.07
Nodes (28): ApiBearerAuth, ApiOperation, ApiProperty, ApiTags, Body, Controller, Delete, Get (+20 more)

### Community 13 - "app.module.ts"
Cohesion: 0.11
Nodes (23): CatalogosModule, Module, ComprasModule, Module, ComprobantesImpresionModule, Module, ComprobantesPublicosModule, Module (+15 more)

### Community 14 - "PrismaService"
Cohesion: 0.13
Nodes (7): JwtStrategy, Injectable, PrismaService, Injectable, TestController, Controller, Get

### Community 15 - "gastos.controller.ts"
Cohesion: 0.11
Nodes (14): GastosController, Body, Controller, Delete, Get, Param, Post, Query (+6 more)

### Community 16 - "products.controller.ts"
Cohesion: 0.11
Nodes (13): CreateProductDto, UpdateProductDto, ProductsController, Body, Controller, Delete, Get, Param (+5 more)

### Community 17 - "comprobante-validation.service.ts"
Cohesion: 0.09
Nodes (29): esExonerado(), esGravado(), esquemaTributario(), fmt(), fmtFecha(), fmtHora(), NS, Injectable (+21 more)

### Community 18 - "QueryReportesDto"
Cohesion: 0.13
Nodes (16): QueryReportesDto, ApiPropertyOptional, IsOptional, IsString, IsUUID, ReportesController, ApiOperation, ApiTags (+8 more)

### Community 19 - "ProductosService"
Cohesion: 0.10
Nodes (18): dtoBase, ProductosController, ApiOperation, ApiTags, Body, Controller, Delete, Get (+10 more)

### Community 20 - "facturacion.module.ts"
Cohesion: 0.14
Nodes (13): CdrParserService, ResultadoCdr, Injectable, EstadoComprobante, ESTADOS_REINTENTABLES, CertificadoExtraido, FirmaService, ResultadoFirma (+5 more)

### Community 21 - "ResumenDiarioService"
Cohesion: 0.27
Nodes (4): fmtFecha(), ResumenDiarioService, soloFecha(), Injectable

### Community 22 - "Roles"
Cohesion: 0.13
Nodes (12): IS_PUBLIC_KEY, Roles(), ROLES_KEY, RolesGuard, Injectable, TenantGuard, Injectable, ROLES_CAJA (+4 more)

### Community 23 - "producto.mapper.ts"
Cohesion: 0.18
Nodes (12): IdNombre, LoteEntrada, MedicamentoEntrada, NumericValue, PresentacionEntrada, ProductoDetalleEntrada, ProductoListaCamposExtendidos, ProductoListaFila (+4 more)

### Community 24 - "comprobante-validation.spec.ts"
Cohesion: 0.13
Nodes (12): nombreArchivoComprobante(), EmitirComprobanteDto, ApiProperty, IsIn, IsUUID, ComprobanteValidationService, Injectable, configOk() (+4 more)

### Community 25 - ".create"
Cohesion: 0.22
Nodes (16): ApiParam, Req, CatalogosController, ApiOperation, ApiResponse, ApiTags, Body, Controller (+8 more)

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, ignoreDeprecations (+13 more)

### Community 27 - "auth.module.ts"
Cohesion: 0.14
Nodes (11): AuthController, Body, Controller, HttpCode, Post, AuthService, Injectable, LoginDto (+3 more)

### Community 28 - "ventas.service.ts"
Cohesion: 0.27
Nodes (7): AuditService, LogAuditParams, Injectable, hashSnapshot(), serializarSnapshot(), setup(), PrismaServiceMock

### Community 29 - "dashboard.module.ts"
Cohesion: 0.12
Nodes (13): DashboardController, ApiOperation, ApiTags, Controller, Get, Headers, Query, Request (+5 more)

### Community 31 - "RealtimeService"
Cohesion: 0.07
Nodes (27): CajasController, ApiOperation, ApiTags, Body, Controller, Get, Headers, HttpCode (+19 more)

### Community 32 - "EscannerGateway"
Cohesion: 0.06
Nodes (25): Catch, AppModule, Module, CORS_METHODS, CorsEnvironment, createCorsOptions(), HTTP_PROTOCOLS, isCorsOriginAllowed() (+17 more)

### Community 33 - "EventsGateway"
Cohesion: 0.06
Nodes (32): ApiResponse, DiagnosticosController, ApiOperation, ApiTags, Controller, Get, UseGuards, CreateCambioDto (+24 more)

### Community 34 - "UsersService"
Cohesion: 0.16
Nodes (9): Controller, Get, Param, UseGuards, UsersController, Module, UsersModule, Injectable (+1 more)

### Community 35 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-config-prettier, @eslint/eslintrc, eslint-plugin-prettier, jest, devDependencies, eslint-config-prettier, @eslint/eslintrc, eslint-plugin-prettier (+11 more)

### Community 36 - "SunatSoapClient"
Cohesion: 0.23
Nodes (7): ENDPOINTS, escapeXml(), SunatSendBillResult, SunatSoapClient, SunatStatusResult, SunatTicketResult, Injectable

### Community 37 - "CreateProductoDto"
Cohesion: 0.17
Nodes (16): CreateProductoDto, PresentacionProductoDto, ApiProperty, ApiPropertyOptional, IsArray, IsBoolean, IsInt, IsNotEmpty (+8 more)

### Community 38 - "UpdateProductoDto"
Cohesion: 0.22
Nodes (8): ApiPropertyOptional, IsBoolean, IsNumber, IsOptional, IsString, Min, Type, UpdateProductoDto

### Community 39 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, certs:qz:dev, db:seed, db:seed-demo, format, lint, render:build (+9 more)

### Community 41 - "configuracion-tributaria.service.ts"
Cohesion: 0.23
Nodes (11): AmbienteSunat, FormaPago, RegimenTributario, UnidadMedidaSunat, comprobantesPermitidos(), errorCoherenciaRucRegimen(), motivoBloqueoEmision(), NOMBRES_REGIMEN (+3 more)

### Community 42 - ".procesarEnvio"
Cohesion: 0.12
Nodes (6): EXTENSIONES_CERTIFICADO, ESTADOS_FINALES, ComprobanteStorageService, FileStorageProvider, LocalFileStorageProvider, Injectable

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
Cohesion: 0.18
Nodes (8): AuthModule, Module, AdministracionGeneralModule, Module, DiagnosticosModule, Module, ProductsModule, Module

### Community 49 - "CreateUsuarioDto"
Cohesion: 0.23
Nodes (10): CreateUsuarioDto, ApiProperty, ApiPropertyOptional, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID (+2 more)

### Community 50 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 51 - "QueryProductosDto"
Cohesion: 0.20
Nodes (10): QueryProductosDto, ApiPropertyOptional, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max (+2 more)

### Community 52 - "producto-detalle.response.ts"
Cohesion: 0.33
Nodes (10): CategoriaResponse, FormaFarmaceuticaResponse, LaboratorioResponse, LoteProductoResponse, MedicamentoResponse, PresentacionResponse, PrincipioActivoResponse, ProductoDetalleResponse (+2 more)

### Community 53 - "dependencies"
Cohesion: 0.22
Nodes (9): adm-zip, axios, class-validator, @nestjs/platform-express, dependencies, adm-zip, axios, class-validator (+1 more)

### Community 54 - ".constructor"
Cohesion: 0.25
Nodes (6): CorrelativoReservado, CorrelativosService, SUNAT_A_TIPO_SERIE, TIPO_SERIE_A_SUNAT, Injectable, TxMock

### Community 55 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 56 - "productos.service.ts"
Cohesion: 0.25
Nodes (5): OrdenProductos, PaginationMetaResponse, ProductoListaItemResponse, ProductoListaResponse, ApiProperty

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

### Community 68 - "QzSecurityService"
Cohesion: 0.31
Nodes (4): QzSecurityModule, Module, QzSecurityService, Injectable

### Community 73 - ""comprobantes_electronicos""
Cohesion: 0.29
Nodes (11): "clientes", "comprobantes_electronicos", "comprobantes_electronicos_detalles", "comprobantes_intentos_envio", "configuraciones_tributarias", "resumenes_diarios", "resumenes_diarios_detalles", "empresas" (+3 more)

### Community 81 - "README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 99 - "generate-qz-dev-cert.ts"
Cohesion: 0.33
Nodes (6): backendRoot, certificatePath, certsDirectory, ensureCertsDirectory(), generateCertificate(), privateKeyPath

### Community 108 - "ComprobantesPublicosService"
Cohesion: 0.17
Nodes (9): ComprobantesPublicosController, Controller, Get, Param, Request, UseGuards, ComprobantesPublicosService, hashesCoinciden() (+1 more)

### Community 112 - "numero-a-letras.util.ts"
Cohesion: 0.31
Nodes (6): CENTENAS, DECENAS, millares(), numeroALetras(), seccion(), UNIDADES

### Community 124 - "Unicidad por botica y evidencia RLS"
Cohesion: 0.29
Nodes (6): Alcance, Alineación de la aplicación, Evidencia de reglas de negocio, Preflight y despliegue, RLS, Unicidad por botica y evidencia RLS

### Community 160 - "CreateGastoDto"
Cohesion: 0.22
Nodes (9): CreateGastoDto, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min (+1 more)

### Community 161 - "dashboard.service.ts"
Cohesion: 0.40
Nodes (4): DashboardQueryDto, ApiPropertyOptional, IsOptional, IsString

## Knowledge Gaps
- **208 isolated node(s):** `name`, `version`, `description`, `author`, `private` (+203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **91 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `AdministracionGeneralService`, `ComprasService`, `catalogos.controller.ts`, `CreateClienteDto`, `ProveedoresService`, `ComprobantePrintData`, `CreateSerieDocumentoDto`, `app.module.ts`, `gastos.controller.ts`, `products.controller.ts`, `comprobante-validation.service.ts`, `QueryReportesDto`, `facturacion.module.ts`, `comprobante-validation.spec.ts`, `auth.module.ts`, `ventas.service.ts`, `RealtimeService`, `EscannerGateway`, `dashboard.service.ts`, `EventsGateway`, `UsersService`, `configuracion-tributaria.service.ts`, `resumen-diario-xml.builder.ts`, `PlatformAdminGuard`, `CreateUsuarioDto`, `.constructor`, `productos.service.ts`, `ComprobantesPublicosService`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `passport`, `PdfGeneratorService`, `@types/pdfmake`, `package.json`, `class-transformer`, `dotenv`, `@nestjs/common`, `@nestjs/config`, `@nestjs/core`, `@nestjs/jwt`, `@nestjs/platform-socket.io`, `@nestjs/swagger`, `@nestjs/websockets`, `passport-jwt`, `pdfmake`, `pg`, `@prisma/adapter-pg`, `@prisma/client`, `reflect-metadata`, `rxjs`, `socket.io`, `swagger-ui-express`, `@types/adm-zip`, `@types/qrcode`, `@types/xmldom`, `xmlbuilder2`, `xmldom`, `bcrypt`, `@nestjs/passport`, `fast-xml-parser`, `node-forge`, `xml-crypto`, `prisma`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `qrcode` connect `PdfGeneratorService` to `dependencies`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _208 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AdministracionGeneralService` be split into smaller, more focused modules?**
  _Cohesion score 0.06127206127206127 - nodes in this community are weakly interconnected._
- **Should `ComprasService` be split into smaller, more focused modules?**
  _Cohesion score 0.05328218243819267 - nodes in this community are weakly interconnected._
- **Should `catalogos.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10967741935483871 - nodes in this community are weakly interconnected._