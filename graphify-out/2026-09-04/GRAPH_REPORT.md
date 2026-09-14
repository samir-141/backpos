# Graph Report - pos-backend  (2026-09-03)

## Corpus Check
- 242 files · ~85,301 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2032 nodes · 3955 edges · 209 communities (104 shown, 105 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68920609`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PrintingQzService
- AdministracionGeneralService
- ComprasService
- catalogos.controller.ts
- clientes.controller.ts
- PdfGeneratorService
- ProveedoresService
- ConfiguracionTributariaController
- VentasService
- 20260729020102_init/migration.sql
- ComprobantePrintData
- CreateSerieDocumentoDto
- RequirePermissions
- app.module.ts
- PrismaService
- StorageService
- products.controller.ts
- tributos-calculator.service.ts
- ReportesService
- ProductosService
- facturacion.service.ts
- facturacion.module.ts
- productos.controller.ts
- producto.mapper.ts
- comprobante-validation.spec.ts
- CatalogosController
- compilerOptions
- AuthService
- QueryProveedoresDto
- DashboardController
- FacturacionService
- RealtimeService
- EscannerGateway
- EventsGateway
- users.module.ts
- devDependencies
- SunatSoapClient
- CreateProductoDto
- productos.service.ts
- scripts
- ComprobantesImpresionService
- comprobante-validation.service.ts
- ComprobanteStorageService
- TenantGuard
- resumen-diario-xml.builder.ts
- PrismaService
- auth.module.ts
- AppController
- sunat-soap.client.ts
- usuarios.controller.ts
- public.vw_productos_pos
- QueryProductosDto
- producto-detalle.response.ts
- dependencies
- CajasController
- public.vw_productos_pos
- correlativos.service.ts
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
- xml-builder.service.ts
- @eslint/js
- "comprobantes_electronicos"
- globals
- UpdateProductoDto
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
- storage.service.ts
- seed-tienda-prueba.js
- @types/xmldom
- generate-qz-dev-cert.ts
- xmlbuilder2
- xmldom
- source-map-support
- supertest
- @swc/core
- ts-loader
- proveedores.service.ts
- tsconfig-paths
- ComprobantesPublicosController
- @types/jest
- @types/passport-jwt
- @types/pg
- UsersController
- typescript-eslint
- test-supabase-storage.js
- @nestjs/passport
- fast-xml-parser
- SeriesDocumentosController
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
- DiagnosticosController
- @types/supertest
- CreateVentaDto
- gastos.controller.ts
- dashboard.service.ts
- tenant.guard.ts
- permissions.guard.ts
- ReportesController
- events.gateway.ts
- GuardarConfiguracionTributariaDto
- posventa.controller.ts
- FileStorageProvider
- axios
- class-validator
- @nestjs/platform-express
- @supabase/supabase-js
- gastos.module.ts
- HttpCode
- Query
- ApiBearerAuth
- ApiOperation
- ApiResponse
- ApiTags
- Body
- Controller
- Delete
- Get
- ClientesController
- Injectable
- Param
- Patch
- Post
- Request
- StorageController
- IsEmail
- IsIn
- IsNotEmpty
- MinLength
- IsNumber
- Transform
- ValidateNested
- ApiPropertyOptional
- IsEnum
- ConnectedSocket
- MessageBody
- SubscribeMessage
- WebSocketGateway
- WebSocketServer
- Controller
- Get
- UseGuards
- UseGuards

## God Nodes (most connected - your core abstractions)
1. `RequirePermissions()` - 96 edges
2. `PrismaService` - 57 edges
3. `"empresas"` - 31 edges
4. `"usuarios"` - 30 edges
5. `EventsGateway` - 29 edges
6. `AdministracionGeneralService` - 25 edges
7. `StorageService` - 24 edges
8. `TenantGuard` - 24 edges
9. `PrismaModule` - 24 edges
10. `PermissionsGuard` - 23 edges

## Surprising Connections (you probably didn't know these)
- `DetallePreparado` --references--> `CreateCompraDetalleDto`  [EXTRACTED]
  src/modules/compras/compras.service.ts → src/modules/compras/dto/compras.dto.ts
- `bootstrap()` --calls--> `createCorsOptions()`  [EXTRACTED]
  src/main.ts → src/common/config/cors.config.ts
- `ComprobantePrintData` --inherits--> `ComprobanteSunatData`  [EXTRACTED]
  src/modules/comprobantes-impresion/interfaces/comprobante-print-data.interface.ts → src/modules/facturacion/domain/comprobante-data.interface.ts
- `setup()` --calls--> `hashSnapshot()`  [EXTRACTED]
  src/modules/comprobantes-publicos/comprobantes-publicos.service.spec.ts → src/modules/comprobantes-publicos/comprobantes-publicos.service.ts
- `ResultadoCdr` --references--> `EstadoComprobante`  [EXTRACTED]
  src/modules/facturacion/cdr/cdr-parser.service.ts → src/modules/facturacion/domain/estado-comprobante.enum.ts

## Import Cycles
- None detected.

## Communities (209 total, 105 thin omitted)

### Community 0 - "PrintingQzService"
Cohesion: 0.10
Nodes (16): ApiProperty, IsString, MaxLength, SignRequestDto, PrintingQzController, ApiBearerAuth, ApiOperation, ApiTags (+8 more)

### Community 1 - "AdministracionGeneralService"
Cohesion: 0.07
Nodes (39): ArrayUnique, IsEmail, IsIn, IsNotEmpty, MinLength, AdministracionGeneralController, Body, Controller (+31 more)

### Community 2 - "ComprasService"
Cohesion: 0.05
Nodes (44): ArrayMaxSize, IsNumber, ComprasController, ApiTags, Body, Controller, Get, Headers (+36 more)

### Community 3 - "catalogos.controller.ts"
Cohesion: 0.09
Nodes (26): CatalogosService, Injectable, CampoEspecial, CatalogoConfig, CATALOGOS_CONFIG, TipoCatalogo, TIPOS_CATALOGO, CreateCatalogoDto (+18 more)

### Community 4 - "clientes.controller.ts"
Cohesion: 0.07
Nodes (24): consultarPadron(), PadronResponse, ClientesService, Injectable, CreateClienteDto, ApiProperty, ApiPropertyOptional, IsEmail (+16 more)

### Community 5 - "PdfGeneratorService"
Cohesion: 0.15
Nodes (12): qrcode, qrcode, ExtrasPdf, fmt(), fontsPdfmake(), FormatoPdf, PdfGeneratorService, PdfKitStream (+4 more)

### Community 6 - "ProveedoresService"
Cohesion: 0.11
Nodes (15): ProveedoresController, ApiTags, Body, Controller, Delete, Get, Param, Patch (+7 more)

### Community 7 - "ConfiguracionTributariaController"
Cohesion: 0.13
Nodes (14): ConfiguracionTributariaController, ApiOperation, ApiTags, Body, Controller, Get, Patch, Post (+6 more)

### Community 8 - "VentasService"
Cohesion: 0.10
Nodes (16): ApiOperation, ApiTags, Body, Controller, Get, Headers, HttpCode, Param (+8 more)

### Community 9 - "20260729020102_init/migration.sql"
Cohesion: 0.24
Nodes (31): "cajas", "categorias", "clientes", "compras", "detalles_compras", "detalles_ventas", "empresas", "formas_farmaceuticas" (+23 more)

### Community 10 - "ComprobantePrintData"
Cohesion: 0.11
Nodes (12): ComprobantePagoData, ComprobantePrintData, A4Template, fmt(), TIPOS_COMPROBANTE, ComprobanteTemplate, fmt(), Ticket58Template (+4 more)

### Community 11 - "CreateSerieDocumentoDto"
Cohesion: 0.13
Nodes (14): CreateSerieDocumentoDto, ApiProperty, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID (+6 more)

### Community 12 - "RequirePermissions"
Cohesion: 0.05
Nodes (51): Put, RequirePermissions(), ResumenDiarioController, ApiOperation, ApiTags, Body, Controller, Get (+43 more)

### Community 13 - "app.module.ts"
Cohesion: 0.07
Nodes (37): AdministracionGeneralModule, Module, AuditModule, Global, Module, CajasModule, Module, CatalogosModule (+29 more)

### Community 14 - "PrismaService"
Cohesion: 0.11
Nodes (14): FindManyArgs, AuditService, LogAuditParams, Injectable, ComprobantesPublicosService, hashesCoinciden(), hashSnapshot(), serializarSnapshot() (+6 more)

### Community 15 - "StorageService"
Cohesion: 0.20
Nodes (4): Optional, StorageService, Injectable, Optional

### Community 16 - "products.controller.ts"
Cohesion: 0.10
Nodes (15): CreateProductDto, UpdateProductDto, ProductsController, Body, Controller, Delete, Get, Param (+7 more)

### Community 17 - "tributos-calculator.service.ts"
Cohesion: 0.11
Nodes (21): ClienteComprobanteData, ComprobanteItemData, ComprobanteSunatData, DocumentoComprobanteData, nombreArchivoComprobante(), TotalesComprobanteData, Injectable, VentaToComprobanteMapper (+13 more)

### Community 18 - "ReportesService"
Cohesion: 0.20
Nodes (4): ReportesModule, Module, ReportesService, Injectable

### Community 19 - "ProductosService"
Cohesion: 0.12
Nodes (18): ProductosController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Headers (+10 more)

### Community 20 - "facturacion.service.ts"
Cohesion: 0.19
Nodes (8): CdrParserService, ResultadoCdr, Injectable, EstadoComprobante, ESTADOS_REINTENTABLES, ComprobanteConDetalles, Injectable, ZipService

### Community 21 - "facturacion.module.ts"
Cohesion: 0.11
Nodes (12): EncryptionService, Injectable, FacturacionModule, Module, CertificadoExtraido, FirmaService, ResultadoFirma, Injectable (+4 more)

### Community 22 - "productos.controller.ts"
Cohesion: 0.20
Nodes (9): Roles(), ROLES_KEY, RolesGuard, Injectable, ROLES_CAJA, TenantRequest, ROLES_GESTION_INVENTARIO, ROLES_LECTURA_PRODUCTOS (+1 more)

### Community 23 - "producto.mapper.ts"
Cohesion: 0.18
Nodes (12): IdNombre, LoteEntrada, MedicamentoEntrada, NumericValue, PresentacionEntrada, ProductoDetalleEntrada, ProductoListaCamposExtendidos, ProductoListaFila (+4 more)

### Community 24 - "comprobante-validation.spec.ts"
Cohesion: 0.14
Nodes (11): EmitirComprobanteDto, ApiProperty, IsIn, IsUUID, ComprobanteValidationService, Injectable, configOk(), OpcionesMock (+3 more)

### Community 25 - "CatalogosController"
Cohesion: 0.20
Nodes (18): ApiParam, Req, CatalogosController, ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, Body (+10 more)

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, ignoreDeprecations (+13 more)

### Community 27 - "AuthService"
Cohesion: 0.12
Nodes (12): AuthController, Body, Controller, HttpCode, Post, Public, AuthService, Injectable (+4 more)

### Community 28 - "QueryProveedoresDto"
Cohesion: 0.22
Nodes (14): CreateProveedorDto, QueryProveedoresDto, IsEmail, IsInt, IsOptional, IsString, Length, Matches (+6 more)

### Community 29 - "DashboardController"
Cohesion: 0.18
Nodes (9): DashboardController, ApiOperation, ApiTags, Controller, Get, Headers, Query, Request (+1 more)

### Community 30 - "FacturacionService"
Cohesion: 0.12
Nodes (17): FacturacionController, ApiOperation, ApiTags, Body, Controller, Get, Headers, HttpCode (+9 more)

### Community 31 - "RealtimeService"
Cohesion: 0.12
Nodes (14): CajaContext, CajasService, Injectable, AperturaCajaDto, CierreCajaDto, MovimientoCajaDto, TipoMovimientoCaja, IsEnum (+6 more)

### Community 32 - "EscannerGateway"
Cohesion: 0.09
Nodes (21): Catch, ConnectedSocket, MessageBody, AppModule, Module, CORS_METHODS, CorsEnvironment, createCorsOptions() (+13 more)

### Community 33 - "EventsGateway"
Cohesion: 0.16
Nodes (7): EventsGateway, ConnectedSocket, Injectable, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 34 - "users.module.ts"
Cohesion: 0.27
Nodes (4): Module, UsersModule, Injectable, UsersService

### Community 35 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint-config-prettier, @eslint/eslintrc, eslint-plugin-prettier, jest, devDependencies, eslint-config-prettier, @eslint/eslintrc, eslint-plugin-prettier (+11 more)

### Community 36 - "SunatSoapClient"
Cohesion: 0.38
Nodes (3): escapeXml(), SunatSoapClient, Injectable

### Community 37 - "CreateProductoDto"
Cohesion: 0.17
Nodes (16): CreateProductoDto, PresentacionProductoDto, ApiProperty, ApiPropertyOptional, IsArray, IsBoolean, IsInt, IsNotEmpty (+8 more)

### Community 38 - "productos.service.ts"
Cohesion: 0.21
Nodes (6): OrdenProductos, dtoBase, PaginationMetaResponse, ProductoListaItemResponse, ProductoListaResponse, ApiProperty

### Community 39 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, certs:qz:dev, db:seed, db:seed-demo, format, lint, render:build (+9 more)

### Community 40 - "ComprobantesImpresionService"
Cohesion: 0.12
Nodes (15): ComprobantesImpresionController, ApiOperation, ApiTags, Body, Controller, Get, Param, Post (+7 more)

### Community 41 - "comprobante-validation.service.ts"
Cohesion: 0.20
Nodes (13): RegimenTributario, comprobantesPermitidos(), errorCoherenciaRucRegimen(), motivoBloqueoEmision(), NOMBRES_REGIMEN, NOMBRES_TIPO, PERMISOS_POR_REGIMEN, puedeEmitir() (+5 more)

### Community 42 - "ComprobanteStorageService"
Cohesion: 0.22
Nodes (3): ComprobanteStorageService, LocalFileStorageProvider, Injectable

### Community 43 - "TenantGuard"
Cohesion: 0.27
Nodes (5): TenantGuard, Injectable, RequestAutenticada, GenerarResumenDto, IsDateString

### Community 44 - "resumen-diario-xml.builder.ts"
Cohesion: 0.25
Nodes (7): DatosResumenDiario, fmt(), fmtFecha(), LineaResumenDiario, ResumenDiarioXmlBuilder, Injectable, EmisorData

### Community 45 - "PrismaService"
Cohesion: 0.20
Nodes (5): PrismaModule, Global, Module, PrismaService, Injectable

### Community 46 - "auth.module.ts"
Cohesion: 0.13
Nodes (8): AuthModule, Module, PlatformAdminGuard, Injectable, JwtStrategy, Injectable, DiagnosticosModule, Module

### Community 47 - "AppController"
Cohesion: 0.20
Nodes (7): AppController, ApiTags, Controller, Get, Public, AppService, Injectable

### Community 48 - "sunat-soap.client.ts"
Cohesion: 0.22
Nodes (8): AmbienteSunat, FormaPago, UnidadMedidaSunat, CredencialesSol, ENDPOINTS, SunatSendBillResult, SunatStatusResult, SunatTicketResult

### Community 49 - "usuarios.controller.ts"
Cohesion: 0.18
Nodes (13): PERMISOS, PERMISOS_ARRAY, ROLES_PERMISOS_MAP, CreateUsuarioDto, ApiProperty, ApiPropertyOptional, IsEmail, IsNotEmpty (+5 more)

### Community 50 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 51 - "QueryProductosDto"
Cohesion: 0.20
Nodes (10): ApiPropertyOptional, IsEnum, QueryProductosDto, IsInt, IsOptional, IsString, IsUUID, Max (+2 more)

### Community 52 - "producto-detalle.response.ts"
Cohesion: 0.33
Nodes (10): CategoriaResponse, FormaFarmaceuticaResponse, LaboratorioResponse, LoteProductoResponse, MedicamentoResponse, PresentacionResponse, PrincipioActivoResponse, ProductoDetalleResponse (+2 more)

### Community 53 - "dependencies"
Cohesion: 0.22
Nodes (9): adm-zip, bcrypt, dependencies, adm-zip, bcrypt, @types/adm-zip, @types/qrcode, @types/adm-zip (+1 more)

### Community 54 - "CajasController"
Cohesion: 0.21
Nodes (13): CajasController, ApiOperation, ApiTags, Body, Controller, Get, Headers, HttpCode (+5 more)

### Community 55 - "public.vw_productos_pos"
Cohesion: 0.18
Nodes (10): public.vw_productos_pos, public.categorias, public.formas_farmaceuticas, public.laboratorios, public.lotes, public.medicamentos, public.principios_activos, public.productos_comerciales (+2 more)

### Community 56 - "correlativos.service.ts"
Cohesion: 0.25
Nodes (6): CorrelativoReservado, CorrelativosService, SUNAT_A_TIPO_SERIE, TIPO_SERIE_A_SUNAT, Injectable, TxMock

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

### Community 71 - "xml-builder.service.ts"
Cohesion: 0.20
Nodes (10): esExonerado(), esGravado(), esquemaTributario(), fmt(), fmtFecha(), fmtHora(), NS, Injectable (+2 more)

### Community 73 - ""comprobantes_electronicos""
Cohesion: 0.29
Nodes (11): "clientes", "comprobantes_electronicos", "comprobantes_electronicos_detalles", "comprobantes_intentos_envio", "configuraciones_tributarias", "resumenes_diarios", "resumenes_diarios_detalles", "empresas" (+3 more)

### Community 75 - "UpdateProductoDto"
Cohesion: 0.22
Nodes (8): ApiPropertyOptional, IsBoolean, IsNumber, IsOptional, IsString, Min, Type, UpdateProductoDto

### Community 81 - "README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 96 - "storage.service.ts"
Cohesion: 0.25
Nodes (5): StorageModule, Module, ResultadoSubida, ResultadoTestConexion, SubirArchivoOptions

### Community 97 - "seed-tienda-prueba.js"
Cohesion: 0.52
Nodes (6): bcrypt, { Client }, ensure(), main(), one(), TIENDA

### Community 99 - "generate-qz-dev-cert.ts"
Cohesion: 0.33
Nodes (6): backendRoot, certificatePath, certsDirectory, ensureCertsDirectory(), generateCertificate(), privateKeyPath

### Community 106 - "proveedores.service.ts"
Cohesion: 0.38
Nodes (3): isValidPeruvianRuc(), createPrismaMock(), resolvedMock()

### Community 108 - "ComprobantesPublicosController"
Cohesion: 0.24
Nodes (7): ComprobantesPublicosController, Controller, Get, Param, Public, Request, UseGuards

### Community 112 - "UsersController"
Cohesion: 0.33
Nodes (4): Controller, Get, Param, UsersController

### Community 117 - "SeriesDocumentosController"
Cohesion: 0.18
Nodes (13): SeriesDocumentosController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+5 more)

### Community 124 - "Unicidad por botica y evidencia RLS"
Cohesion: 0.29
Nodes (6): Alcance, Alineación de la aplicación, Evidencia de reglas de negocio, Preflight y despliegue, RLS, Unicidad por botica y evidencia RLS

### Community 157 - "DiagnosticosController"
Cohesion: 0.25
Nodes (7): DiagnosticosController, ApiOperation, ApiResponse, ApiTags, Controller, Get, UseGuards

### Community 159 - "CreateVentaDto"
Cohesion: 0.20
Nodes (16): CreateVentaDto, DatosClienteDto, DetalleVentaItemDto, ApiProperty, ApiPropertyOptional, ArrayMinSize, IsArray, IsInt (+8 more)

### Community 160 - "gastos.controller.ts"
Cohesion: 0.15
Nodes (11): CreateGastoDto, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min (+3 more)

### Community 161 - "dashboard.service.ts"
Cohesion: 0.22
Nodes (6): DashboardService, Injectable, DashboardQueryDto, ApiPropertyOptional, IsOptional, IsString

### Community 162 - "tenant.guard.ts"
Cohesion: 0.19
Nodes (7): IS_PUBLIC_KEY, Public(), GlobalAuthGuard, Injectable, ImprimirComprobanteDto, IsEnum, IsNotEmpty

### Community 163 - "permissions.guard.ts"
Cohesion: 0.18
Nodes (8): PERMISSIONS_KEY, PermissionsGuard, Injectable, QueryReportesDto, ApiPropertyOptional, IsOptional, IsString, IsUUID

### Community 164 - "ReportesController"
Cohesion: 0.30
Nodes (9): ReportesController, ApiOperation, ApiTags, Controller, Get, Headers, Query, Request (+1 more)

### Community 165 - "events.gateway.ts"
Cohesion: 0.15
Nodes (5): dto, UserConnectionInfo, SocketAuthService, SocketUser, Injectable

### Community 166 - "GuardarConfiguracionTributariaDto"
Cohesion: 0.15
Nodes (12): AMBIENTES, GuardarConfiguracionTributariaDto, REGIMENES, ApiProperty, ApiPropertyOptional, IsBoolean, IsIn, IsOptional (+4 more)

### Community 167 - "posventa.controller.ts"
Cohesion: 0.19
Nodes (6): CreateCambioDto, CreateDevolucionDto, CreateGarantiaDto, CreateReclamoDto, PosventaService, Injectable

### Community 173 - "gastos.module.ts"
Cohesion: 0.22
Nodes (4): GastosModule, Module, GastosService, Injectable

### Community 187 - "ClientesController"
Cohesion: 0.19
Nodes (15): HttpCode, Query, ClientesController, ApiOperation, ApiTags, Body, Controller, Delete (+7 more)

### Community 193 - "StorageController"
Cohesion: 0.13
Nodes (16): ApiConsumes, Roles, StorageController, ApiOperation, ApiTags, Body, Controller, Delete (+8 more)

## Knowledge Gaps
- **218 isolated node(s):** `name`, `version`, `description`, `author`, `private` (+213 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **105 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequirePermissions()` connect `RequirePermissions` to `ComprasService`, `catalogos.controller.ts`, `clientes.controller.ts`, `ProveedoresService`, `ConfiguracionTributariaController`, `VentasService`, `CreateSerieDocumentoDto`, `ProductosService`, `productos.controller.ts`, `CatalogosController`, `DashboardController`, `FacturacionService`, `gastos.controller.ts`, `tenant.guard.ts`, `permissions.guard.ts`, `ReportesController`, `posventa.controller.ts`, `ComprobantesImpresionService`, `TenantGuard`, `usuarios.controller.ts`, `CajasController`, `StorageController`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `AdministracionGeneralService`, `ComprasService`, `catalogos.controller.ts`, `clientes.controller.ts`, `ComprobantePrintData`, `CreateSerieDocumentoDto`, `app.module.ts`, `products.controller.ts`, `ReportesService`, `facturacion.service.ts`, `facturacion.module.ts`, `comprobante-validation.spec.ts`, `RealtimeService`, `gastos.controller.ts`, `dashboard.service.ts`, `users.module.ts`, `permissions.guard.ts`, `events.gateway.ts`, `productos.service.ts`, `posventa.controller.ts`, `comprobante-validation.service.ts`, `resumen-diario-xml.builder.ts`, `gastos.module.ts`, `auth.module.ts`, `usuarios.controller.ts`, `storage.service.ts`, `proveedores.service.ts`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `PdfGeneratorService` connect `PdfGeneratorService` to `facturacion.service.ts`, `facturacion.module.ts`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _218 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PrintingQzService` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `AdministracionGeneralService` be split into smaller, more focused modules?**
  _Cohesion score 0.06918918918918919 - nodes in this community are weakly interconnected._
- **Should `ComprasService` be split into smaller, more focused modules?**
  _Cohesion score 0.05217391304347826 - nodes in this community are weakly interconnected._