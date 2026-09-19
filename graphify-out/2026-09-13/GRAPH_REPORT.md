# Graph Report - pos-backend  (2026-09-04)

## Corpus Check
- 254 files · ~91,051 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2140 nodes · 4233 edges · 215 communities (105 shown, 110 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1f1c2525`
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
- StorageService
- VentasService
- 20260729020102_init/migration.sql
- comprobantes-impresion.service.ts
- CreateSerieDocumentoDto
- UsuariosController
- app.module.ts
- src/prisma/prisma.service.ts
- ResumenDiarioController
- products.controller.ts
- facturacion.service.ts
- reportes.controller.ts
- ProductosService
- facturacion.module.ts
- FirmaService
- perfiles-tributarios.controller.ts
- producto.mapper.ts
- comprobante-validation.service.ts
- CatalogosController
- compilerOptions
- auth.module.ts
- gastos.controller.ts
- DashboardController
- FacturacionService
- CajasService
- EscannerGateway
- EventsGateway
- users.module.ts
- devDependencies
- SunatSoapClient
- CreateProductoDto
- productos.service.ts
- scripts
- ComprobantesImpresionService
- perfiles-tributarios.service.ts
- ComprobanteStorageService
- PosventaController
- resumen-diario-xml.builder.ts
- PrismaService
- PlatformAdminGuard
- public.decorator.ts
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
- RealtimeService
- seed-tienda-prueba.js
- @types/xmldom
- generate-qz-dev-cert.ts
- xmlbuilder2
- xmldom
- source-map-support
- supertest
- @swc/core
- ts-loader
- PrismaService
- tsconfig-paths
- ComprobantesPublicosController
- @types/jest
- @types/passport-jwt
- @types/pg
- administracion-general.module.ts
- typescript-eslint
- test-supabase-storage.js
- @nestjs/passport
- fast-xml-parser
- productos.controller.ts
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
- CreateGastoDto
- dashboard.service.ts
- ImprimirComprobanteDto
- RequirePermissions
- ReportesController
- events.gateway.ts
- GuardarConfiguracionTributariaDto
- posventa.service.ts
- cajas.module.ts
- axios
- class-validator
- @nestjs/platform-express
- @supabase/supabase-js
- dashboard.module.ts
- HttpCode
- Query
- perfiles-tributarios.module.ts
- emission-provider.interface.ts
- ArrayMinSize
- ApiBearerAuth
- ApiOperation
- ApiResponse
- ApiTags
- Body
- Controller
- Delete
- Get
- IsArray
- Injectable
- Param
- Patch
- Post
- Request
- PerfilesTributariosController
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
- IsInt
- IsNotEmpty
- ValidateNested

## God Nodes (most connected - your core abstractions)
1. `RequirePermissions()` - 97 edges
2. `PrismaService` - 56 edges
3. `"empresas"` - 31 edges
4. `"usuarios"` - 30 edges
5. `EventsGateway` - 29 edges
6. `AdministracionGeneralService` - 25 edges
7. `TenantGuard` - 25 edges
8. `PrismaModule` - 25 edges
9. `StorageService` - 24 edges
10. `PermissionsGuard` - 24 edges

## Surprising Connections (you probably didn't know these)
- `DetallePreparado` --references--> `CreateCompraDetalleDto`  [EXTRACTED]
  src/modules/compras/compras.service.ts → src/modules/compras/dto/compras.dto.ts
- `bootstrap()` --calls--> `createCorsOptions()`  [EXTRACTED]
  src/main.ts → src/common/config/cors.config.ts
- `setup()` --calls--> `hashSnapshot()`  [EXTRACTED]
  src/modules/comprobantes-publicos/comprobantes-publicos.service.spec.ts → src/modules/comprobantes-publicos/comprobantes-publicos.service.ts
- `ResultadoCdr` --references--> `EstadoComprobante`  [EXTRACTED]
  src/modules/facturacion/cdr/cdr-parser.service.ts → src/modules/facturacion/domain/estado-comprobante.enum.ts
- `ComprobantePrintData` --inherits--> `ComprobanteSunatData`  [EXTRACTED]
  src/modules/comprobantes-impresion/interfaces/comprobante-print-data.interface.ts → src/modules/facturacion/domain/comprobante-data.interface.ts

## Import Cycles
- None detected.

## Communities (215 total, 110 thin omitted)

### Community 0 - "PrintingQzService"
Cohesion: 0.10
Nodes (16): ApiProperty, IsString, MaxLength, SignRequestDto, PrintingQzController, ApiBearerAuth, ApiOperation, ApiTags (+8 more)

### Community 1 - "AdministracionGeneralService"
Cohesion: 0.07
Nodes (39): ArrayUnique, IsEmail, IsIn, IsNotEmpty, MinLength, AdministracionGeneralController, Body, Controller (+31 more)

### Community 2 - "ComprasService"
Cohesion: 0.05
Nodes (43): ArrayMaxSize, IsNumber, ComprasController, ApiTags, Body, Controller, Get, Headers (+35 more)

### Community 3 - "catalogos.controller.ts"
Cohesion: 0.09
Nodes (26): CatalogosService, Injectable, CampoEspecial, CatalogoConfig, CATALOGOS_CONFIG, TipoCatalogo, TIPOS_CATALOGO, CreateCatalogoDto (+18 more)

### Community 4 - "clientes.controller.ts"
Cohesion: 0.05
Nodes (39): HttpCode, Query, consultarPadron(), PadronResponse, ClientesController, ApiOperation, ApiTags, Body (+31 more)

### Community 5 - "PdfGeneratorService"
Cohesion: 0.15
Nodes (12): qrcode, qrcode, ExtrasPdf, fmt(), fontsPdfmake(), FormatoPdf, PdfGeneratorService, PdfKitStream (+4 more)

### Community 6 - "ProveedoresService"
Cohesion: 0.07
Nodes (30): isValidPeruvianRuc(), CreateProveedorDto, QueryProveedoresDto, IsEmail, IsInt, IsOptional, IsString, Length (+22 more)

### Community 7 - "StorageService"
Cohesion: 0.05
Nodes (36): ApiConsumes, ConfiguracionTributariaController, ApiOperation, ApiTags, Body, Controller, Get, Patch (+28 more)

### Community 8 - "VentasService"
Cohesion: 0.10
Nodes (16): ApiOperation, ApiTags, Body, Controller, Get, Headers, HttpCode, Param (+8 more)

### Community 9 - "20260729020102_init/migration.sql"
Cohesion: 0.24
Nodes (31): "cajas", "categorias", "clientes", "compras", "detalles_compras", "detalles_ventas", "empresas", "formas_farmaceuticas" (+23 more)

### Community 10 - "comprobantes-impresion.service.ts"
Cohesion: 0.11
Nodes (13): ComprobantePagoData, ComprobantePrintData, A4Template, fmt(), TIPOS_COMPROBANTE, ComprobanteTemplate, fmt(), Ticket58Template (+5 more)

### Community 11 - "CreateSerieDocumentoDto"
Cohesion: 0.08
Nodes (27): CreateSerieDocumentoDto, ApiProperty, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID (+19 more)

### Community 12 - "UsuariosController"
Cohesion: 0.13
Nodes (16): ApiOperation, ApiTags, Body, Controller, Delete, Get, HttpCode, Param (+8 more)

### Community 13 - "app.module.ts"
Cohesion: 0.08
Nodes (34): AuditModule, Global, Module, CatalogosModule, Module, ClientesModule, Module, ComprasModule (+26 more)

### Community 14 - "src/prisma/prisma.service.ts"
Cohesion: 0.14
Nodes (11): AuditService, LogAuditParams, Injectable, ComprobantesPublicosService, hashesCoinciden(), hashSnapshot(), serializarSnapshot(), setup() (+3 more)

### Community 15 - "ResumenDiarioController"
Cohesion: 0.22
Nodes (12): ResumenDiarioController, ApiOperation, ApiTags, Body, Controller, Get, HttpCode, Param (+4 more)

### Community 16 - "products.controller.ts"
Cohesion: 0.11
Nodes (13): CreateProductDto, UpdateProductDto, ProductsController, Body, Controller, Delete, Get, Param (+5 more)

### Community 17 - "facturacion.service.ts"
Cohesion: 0.12
Nodes (20): UnidadMedidaSunat, ClienteComprobanteData, ComprobanteItemData, DocumentoComprobanteData, nombreArchivoComprobante(), TotalesComprobanteData, ESTADOS_REINTENTABLES, ComprobanteConDetalles (+12 more)

### Community 18 - "reportes.controller.ts"
Cohesion: 0.17
Nodes (7): QueryReportesDto, ApiPropertyOptional, IsOptional, IsString, IsUUID, ReportesService, Injectable

### Community 19 - "ProductosService"
Cohesion: 0.12
Nodes (18): ProductosController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Headers (+10 more)

### Community 20 - "facturacion.module.ts"
Cohesion: 0.23
Nodes (6): CdrParserService, ResultadoCdr, Injectable, EstadoComprobante, Injectable, ZipService

### Community 21 - "FirmaService"
Cohesion: 0.14
Nodes (8): CertificadoExtraido, FirmaService, ResultadoFirma, Injectable, fmtFecha(), ResumenDiarioService, soloFecha(), Injectable

### Community 22 - "perfiles-tributarios.controller.ts"
Cohesion: 0.27
Nodes (7): Roles(), ROLES_KEY, RolesGuard, Injectable, RequestAutenticada, GenerarResumenDto, IsDateString

### Community 23 - "producto.mapper.ts"
Cohesion: 0.18
Nodes (12): IdNombre, LoteEntrada, MedicamentoEntrada, NumericValue, PresentacionEntrada, ProductoDetalleEntrada, ProductoListaCamposExtendidos, ProductoListaFila (+4 more)

### Community 24 - "comprobante-validation.service.ts"
Cohesion: 0.10
Nodes (18): EmitirComprobanteDto, ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsUUID, Injectable, VentaToComprobanteMapper (+10 more)

### Community 25 - "CatalogosController"
Cohesion: 0.20
Nodes (18): ApiParam, Req, CatalogosController, ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, Body (+10 more)

### Community 26 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, ignoreDeprecations (+13 more)

### Community 27 - "auth.module.ts"
Cohesion: 0.13
Nodes (12): AuthController, Body, Controller, HttpCode, Post, Public, AuthService, Injectable (+4 more)

### Community 28 - "gastos.controller.ts"
Cohesion: 0.16
Nodes (10): GastosController, Body, Controller, Delete, Get, Param, Post, Query (+2 more)

### Community 29 - "DashboardController"
Cohesion: 0.18
Nodes (9): DashboardController, ApiOperation, ApiTags, Controller, Get, Headers, Query, Request (+1 more)

### Community 30 - "FacturacionService"
Cohesion: 0.11
Nodes (18): FacturacionController, ApiOperation, ApiTags, Body, Controller, Get, Headers, HttpCode (+10 more)

### Community 31 - "CajasService"
Cohesion: 0.11
Nodes (16): CajasAutoCierreService, Injectable, CajaContext, CajasService, Injectable, AperturaCajaDto, CierreCajaDto, MovimientoCajaDto (+8 more)

### Community 32 - "EscannerGateway"
Cohesion: 0.09
Nodes (21): Catch, ConnectedSocket, MessageBody, AppModule, Module, CORS_METHODS, CorsEnvironment, createCorsOptions() (+13 more)

### Community 33 - "EventsGateway"
Cohesion: 0.16
Nodes (7): EventsGateway, ConnectedSocket, Injectable, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 34 - "users.module.ts"
Cohesion: 0.15
Nodes (8): Controller, Get, Param, UsersController, Module, UsersModule, Injectable, UsersService

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

### Community 41 - "perfiles-tributarios.service.ts"
Cohesion: 0.17
Nodes (10): EncryptionService, Injectable, comprobantesPermitidos(), errorCoherenciaRucRegimen(), motivoBloqueoEmision(), NOMBRES_REGIMEN, NOMBRES_TIPO, PERMISOS_POR_REGIMEN (+2 more)

### Community 42 - "ComprobanteStorageService"
Cohesion: 0.16
Nodes (4): ComprobanteStorageService, FileStorageProvider, LocalFileStorageProvider, Injectable

### Community 43 - "PosventaController"
Cohesion: 0.24
Nodes (11): PosventaController, ApiOperation, ApiTags, Body, Controller, Get, HttpCode, Param (+3 more)

### Community 44 - "resumen-diario-xml.builder.ts"
Cohesion: 0.25
Nodes (7): DatosResumenDiario, fmt(), fmtFecha(), LineaResumenDiario, ResumenDiarioXmlBuilder, Injectable, EmisorData

### Community 45 - "PrismaService"
Cohesion: 0.20
Nodes (5): PrismaModule, Global, Module, PrismaService, Injectable

### Community 47 - "public.decorator.ts"
Cohesion: 0.12
Nodes (11): AppController, ApiTags, Controller, Get, Public, AppService, Injectable, IS_PUBLIC_KEY (+3 more)

### Community 48 - "sunat-soap.client.ts"
Cohesion: 0.18
Nodes (10): AmbienteSunat, FormaPago, RegimenTributario, SistemaEmision, TipoContribuyente, CredencialesSol, ENDPOINTS, SunatSendBillResult (+2 more)

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
Cohesion: 0.16
Nodes (13): esExonerado(), esGravado(), esquemaTributario(), fmt(), fmtFecha(), fmtHora(), NS, Injectable (+5 more)

### Community 73 - ""comprobantes_electronicos""
Cohesion: 0.21
Nodes (14): "clientes", "comprobantes_electronicos", "comprobantes_electronicos", "comprobantes_electronicos_detalles", "comprobantes_intentos_envio", "configuraciones_tributarias", "resumenes_diarios", "resumenes_diarios_detalles" (+6 more)

### Community 75 - "UpdateProductoDto"
Cohesion: 0.22
Nodes (8): ApiPropertyOptional, IsBoolean, IsNumber, IsOptional, IsString, Min, Type, UpdateProductoDto

### Community 81 - "README.md"
Cohesion: 0.20
Nodes (9): Compile and run the project, Deployment, Description, License, Project setup, Resources, Run tests, Stay in touch (+1 more)

### Community 96 - "RealtimeService"
Cohesion: 0.20
Nodes (3): dto, RealtimeService, Injectable

### Community 97 - "seed-tienda-prueba.js"
Cohesion: 0.52
Nodes (6): bcrypt, { Client }, ensure(), main(), one(), TIENDA

### Community 99 - "generate-qz-dev-cert.ts"
Cohesion: 0.33
Nodes (6): backendRoot, certificatePath, certsDirectory, ensureCertsDirectory(), generateCertificate(), privateKeyPath

### Community 106 - "PrismaService"
Cohesion: 0.15
Nodes (6): JwtStrategy, Injectable, createPrismaMock(), resolvedMock(), PrismaService, Injectable

### Community 108 - "ComprobantesPublicosController"
Cohesion: 0.24
Nodes (7): ComprobantesPublicosController, Controller, Get, Param, Public, Request, UseGuards

### Community 112 - "administracion-general.module.ts"
Cohesion: 0.18
Nodes (8): AuthModule, Module, AdministracionGeneralModule, Module, DiagnosticosModule, Module, ProductsModule, Module

### Community 117 - "productos.controller.ts"
Cohesion: 0.25
Nodes (4): GastosAdminGuard, Injectable, ROLES_GESTION_INVENTARIO, ROLES_LECTURA_PRODUCTOS

### Community 124 - "Unicidad por botica y evidencia RLS"
Cohesion: 0.29
Nodes (6): Alcance, Alineación de la aplicación, Evidencia de reglas de negocio, Preflight y despliegue, RLS, Unicidad por botica y evidencia RLS

### Community 157 - "DiagnosticosController"
Cohesion: 0.25
Nodes (7): DiagnosticosController, ApiOperation, ApiResponse, ApiTags, Controller, Get, UseGuards

### Community 159 - "CreateVentaDto"
Cohesion: 0.21
Nodes (15): ArrayMinSize, IsArray, IsInt, CreateVentaDto, DatosClienteDto, DetalleVentaItemDto, ApiProperty, ApiPropertyOptional (+7 more)

### Community 160 - "CreateGastoDto"
Cohesion: 0.13
Nodes (11): CreateGastoDto, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min (+3 more)

### Community 161 - "dashboard.service.ts"
Cohesion: 0.40
Nodes (4): DashboardQueryDto, ApiPropertyOptional, IsOptional, IsString

### Community 162 - "ImprimirComprobanteDto"
Cohesion: 0.50
Nodes (3): ImprimirComprobanteDto, IsEnum, IsNotEmpty

### Community 163 - "RequirePermissions"
Cohesion: 0.21
Nodes (9): PERMISSIONS_KEY, RequirePermissions(), PermissionsGuard, Injectable, TenantGuard, Injectable, ROLES_CAJA, TenantRequest (+1 more)

### Community 164 - "ReportesController"
Cohesion: 0.30
Nodes (9): ReportesController, ApiOperation, ApiTags, Controller, Get, Headers, Query, Request (+1 more)

### Community 165 - "events.gateway.ts"
Cohesion: 0.19
Nodes (4): UserConnectionInfo, SocketAuthService, SocketUser, Injectable

### Community 166 - "GuardarConfiguracionTributariaDto"
Cohesion: 0.15
Nodes (12): AMBIENTES, GuardarConfiguracionTributariaDto, REGIMENES, ApiProperty, ApiPropertyOptional, IsBoolean, IsIn, IsOptional (+4 more)

### Community 167 - "posventa.service.ts"
Cohesion: 0.15
Nodes (6): CreateCambioDto, CreateDevolucionDto, CreateGarantiaDto, CreateReclamoDto, PosventaService, Injectable

### Community 168 - "cajas.module.ts"
Cohesion: 0.33
Nodes (5): CajasModule, Module, EventsModule, Global, Module

### Community 173 - "dashboard.module.ts"
Cohesion: 0.29
Nodes (4): DashboardModule, Module, DashboardService, Injectable

### Community 176 - "perfiles-tributarios.module.ts"
Cohesion: 0.40
Nodes (4): FacturacionModule, Module, PerfilesTributariosModule, Module

### Community 177 - "emission-provider.interface.ts"
Cohesion: 0.40
Nodes (3): EmissionContext, EmissionResult, IEmissionProvider

### Community 193 - "PerfilesTributariosController"
Cohesion: 0.06
Nodes (43): Length, Matches, Put, Roles, requiereCertificadoDigital(), CreatePerfilTributarioDto, REGIMENES, TIPOS_CONTRIBUYENTE (+35 more)

## Knowledge Gaps
- **226 isolated node(s):** `CajaContext`, `FormaPago`, `TipoContribuyente`, `PERMISOS_POR_REGIMEN`, `NOMBRES_TIPO` (+221 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **110 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequirePermissions()` connect `RequirePermissions` to `ComprasService`, `catalogos.controller.ts`, `clientes.controller.ts`, `ProveedoresService`, `StorageService`, `VentasService`, `UsuariosController`, `ResumenDiarioController`, `reportes.controller.ts`, `ProductosService`, `perfiles-tributarios.controller.ts`, `CatalogosController`, `gastos.controller.ts`, `DashboardController`, `FacturacionService`, `ReportesController`, `ComprobantesImpresionService`, `PosventaController`, `usuarios.controller.ts`, `CajasController`, `productos.controller.ts`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **Why does `PdfGeneratorService` connect `PdfGeneratorService` to `facturacion.service.ts`, `facturacion.module.ts`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `passport`, `PdfGeneratorService`, `@types/pdfmake`, `axios`, `class-validator`, `@nestjs/platform-express`, `@supabase/supabase-js`, `package.json`, `class-transformer`, `dotenv`, `@nestjs/common`, `@nestjs/config`, `@nestjs/core`, `@nestjs/jwt`, `@nestjs/platform-socket.io`, `@nestjs/swagger`, `@nestjs/websockets`, `passport-jwt`, `pdfmake`, `pg`, `@prisma/adapter-pg`, `@prisma/client`, `reflect-metadata`, `rxjs`, `socket.io`, `swagger-ui-express`, `@types/xmldom`, `xmlbuilder2`, `xmldom`, `@nestjs/passport`, `fast-xml-parser`, `node-forge`, `xml-crypto`, `prisma`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **What connects `CajaContext`, `FormaPago`, `TipoContribuyente` to the rest of the system?**
  _226 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PrintingQzService` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `AdministracionGeneralService` be split into smaller, more focused modules?**
  _Cohesion score 0.0673274094326726 - nodes in this community are weakly interconnected._
- **Should `ComprasService` be split into smaller, more focused modules?**
  _Cohesion score 0.05328218243819267 - nodes in this community are weakly interconnected._