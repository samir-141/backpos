-- CreateTable
CREATE TABLE "cajas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sucursal_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'CERRADA',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "tipo_documento" VARCHAR(10) NOT NULL,
    "numero_documento" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "direccion" TEXT,
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "tipo_cliente" VARCHAR(20) DEFAULT 'NATURAL',
    "condicion_contribuyente" VARCHAR(20) DEFAULT 'HABIDO',
    "estado_sunat" VARCHAR(50),
    "fecha_consulta_sunat" TIMESTAMPTZ(6),
    "estado" VARCHAR(20) DEFAULT 'ACTIVO',
    "limite_credito" DECIMAL(15,2) DEFAULT 0,
    "dias_credito" INTEGER DEFAULT 0,
    "saldo_actual" DECIMAL(15,2) DEFAULT 0,
    "estado_credito" VARCHAR(20) DEFAULT 'AL CORRIENTE',
    "whatsapp" VARCHAR(20),
    "contacto_principal" VARCHAR(150),
    "cargo_contacto" VARCHAR(100),
    "representante_legal" VARCHAR(150),
    "dni_representante" VARCHAR(20),
    "fecha_nacimiento" DATE,
    "observaciones" TEXT,
    "origen" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proveedor_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serie" VARCHAR(10) NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "igv" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_compras" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "compra_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "producto_presentacion_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(15,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "detalles_compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_ventas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venta_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "producto_presentacion_id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario_presentacion" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "detalles_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(150) NOT NULL,
    "direccion" TEXT,
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "configuracion" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formas_farmaceuticas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "formas_farmaceuticas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratorios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "pais" VARCHAR(50),
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "laboratorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "producto_comercial_id" UUID NOT NULL,
    "detalle_compra_id" UUID,
    "sucursal_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "numero_lote" VARCHAR(50) NOT NULL,
    "fecha_fabricacion" DATE,
    "fecha_vencimiento" DATE NOT NULL,
    "precio_compra_unidad_base" DECIMAL(15,4) NOT NULL,
    "stock_actual" INTEGER NOT NULL DEFAULT 0,
    "fecha_ingreso" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicamentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "principio_activo_id" UUID NOT NULL,
    "forma_farmaceutica_id" UUID NOT NULL,
    "concentracion" DECIMAL(10,2) NOT NULL,
    "unidad_concentracion" VARCHAR(20) NOT NULL,
    "via_administracion" VARCHAR(50) NOT NULL,
    "requiere_receta" BOOLEAN NOT NULL DEFAULT false,
    "afecto_igv" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metodos_pago" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "requiere_referencia" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caja_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "referencia_id" UUID,
    "fecha" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "observacion" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lote_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "tipo_movimiento_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stock_anterior" INTEGER NOT NULL,
    "stock_nuevo" INTEGER NOT NULL,
    "documento_referencia" VARCHAR(50),
    "fecha" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "observacion" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venta_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "metodo_pago_id" UUID NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "referencia" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "principios_activos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "principios_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_comerciales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "medicamento_id" UUID NOT NULL,
    "laboratorio_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "unidad_base_id" UUID NOT NULL,
    "sku" VARCHAR(50),
    "nombre_comercial" VARCHAR(150) NOT NULL,
    "registro_sanitario" VARCHAR(50),
    "codigo_interno" VARCHAR(50),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "productos_comerciales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_presentaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "producto_comercial_id" UUID NOT NULL,
    "unidad_presentacion_id" UUID NOT NULL,
    "cantidad_unidad_base" INTEGER NOT NULL,
    "codigo_barras" VARCHAR(50),
    "precio_actual" DECIMAL(15,2) NOT NULL,
    "orden" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "productos_presentaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(150) NOT NULL,
    "direccion" TEXT,
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sucursales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sucursales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_movimientos_inventario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "afecta_stock" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tipos_movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_presentacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "abreviatura" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "unidades_presentacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "rol_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migracion_log" (
    "id" SERIAL NOT NULL,
    "botica_id" UUID NOT NULL,
    "tabla" VARCHAR(100),
    "operacion" VARCHAR(50),
    "registros_afectados" INTEGER,
    "fecha" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "observacion" TEXT,

    CONSTRAINT "migracion_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_sucursales" (
    "usuario_id" UUID NOT NULL,
    "botica_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "es_principal" BOOLEAN DEFAULT false,
    "activo" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "usuario_sucursales_pkey" PRIMARY KEY ("usuario_id","sucursal_id")
);

-- CreateTable
CREATE TABLE "historial_precios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "producto_presentacion_id" UUID NOT NULL,
    "precio_anterior" DECIMAL(15,2) NOT NULL,
    "precio_nuevo" DECIMAL(15,2) NOT NULL,
    "motivo" VARCHAR(255),
    "fecha_cambio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "historial_precios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_documentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "tipo_documento" VARCHAR(20) NOT NULL,
    "serie" VARCHAR(10) NOT NULL,
    "correlativo_inicial" INTEGER NOT NULL DEFAULT 1,
    "correlativo_actual" INTEGER NOT NULL DEFAULT 1,
    "longitud_correlativo" INTEGER NOT NULL DEFAULT 8,
    "sucursal_id" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "series_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "cliente_id" UUID,
    "usuario_id" UUID NOT NULL,
    "caja_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igv" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'EMITIDO',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_cajas_botica_id" ON "cajas"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_categorias_nombre_activo" ON "categorias"("nombre") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_categorias_botica_id" ON "categorias"("botica_id");

-- CreateIndex
CREATE INDEX "idx_clientes_botica_id" ON "clientes"("botica_id");

-- CreateIndex
CREATE INDEX "idx_clientes_numero_documento" ON "clientes"("numero_documento") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "idx_clientes_documento_activo" ON "clientes"("tipo_documento", "numero_documento", "botica_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_compras_fecha" ON "compras"("fecha") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_compras_botica_id" ON "compras"("botica_id");

-- CreateIndex
CREATE INDEX "idx_compras_proveedor_id" ON "compras"("proveedor_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_compras_sucursal_id" ON "compras"("sucursal_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_compras_usuario_id" ON "compras"("usuario_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_detalles_compras_botica_id" ON "detalles_compras"("botica_id");

-- CreateIndex
CREATE INDEX "idx_detalles_compras_compra_id" ON "detalles_compras"("compra_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_detalles_ventas_botica_id" ON "detalles_ventas"("botica_id");

-- CreateIndex
CREATE INDEX "idx_detalles_ventas_venta_id" ON "detalles_ventas"("venta_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "idx_boticas_ruc_activo" ON "empresas"("ruc") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "idx_formas_farmaceuticas_nombre_activo" ON "formas_farmaceuticas"("nombre") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_formas_farmaceuticas_botica_id" ON "formas_farmaceuticas"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_laboratorios_nombre_activo" ON "laboratorios"("nombre") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_laboratorios_botica_id" ON "laboratorios"("botica_id");

-- CreateIndex
CREATE INDEX "idx_lotes_botica_id" ON "lotes"("botica_id");

-- CreateIndex
CREATE INDEX "idx_lotes_fefo" ON "lotes"("fecha_vencimiento", "stock_actual") WHERE ((deleted_at IS NULL) AND (stock_actual > 0));

-- CreateIndex
CREATE INDEX "idx_lotes_producto_comercial_id" ON "lotes"("producto_comercial_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_lotes_sucursal_id" ON "lotes"("sucursal_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "idx_lotes_unicidad_activo" ON "lotes"("producto_comercial_id", "numero_lote", "sucursal_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_medicamentos_botica_id" ON "medicamentos"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_metodos_pago_nombre_activo" ON "metodos_pago"("nombre") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_metodos_pago_botica_id" ON "metodos_pago"("botica_id");

-- CreateIndex
CREATE INDEX "idx_movimientos_caja_botica_id" ON "movimientos_caja"("botica_id");

-- CreateIndex
CREATE INDEX "idx_movimientos_caja_caja_id" ON "movimientos_caja"("caja_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_movimientos_inventario_botica_id" ON "movimientos_inventario"("botica_id");

-- CreateIndex
CREATE INDEX "idx_movimientos_inventario_lote_id" ON "movimientos_inventario"("lote_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_pagos_botica_id" ON "pagos"("botica_id");

-- CreateIndex
CREATE INDEX "idx_pagos_venta_id" ON "pagos"("venta_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "idx_permisos_codigo_activo" ON "permisos"("codigo") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_permisos_botica_id" ON "permisos"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_principios_activos_nombre_activo" ON "principios_activos"("nombre") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_principios_activos_botica_id" ON "principios_activos"("botica_id");

-- CreateIndex
CREATE INDEX "idx_principios_activos_nombre" ON "principios_activos"("nombre") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "idx_productos_sku_activo" ON "productos_comerciales"("sku") WHERE ((deleted_at IS NULL) AND (sku IS NOT NULL));

-- CreateIndex
CREATE UNIQUE INDEX "idx_productos_codigo_interno_activo" ON "productos_comerciales"("codigo_interno") WHERE ((deleted_at IS NULL) AND (codigo_interno IS NOT NULL));

-- CreateIndex
CREATE INDEX "idx_productos_codigo_interno_busqueda" ON "productos_comerciales"("codigo_interno") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_productos_sku_busqueda" ON "productos_comerciales"("sku") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_productos_comerciales_botica_id" ON "productos_comerciales"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_presentaciones_codigo_barras_activo" ON "productos_presentaciones"("codigo_barras") WHERE ((deleted_at IS NULL) AND (codigo_barras IS NOT NULL));

-- CreateIndex
CREATE INDEX "idx_presentaciones_codigo_barras_busqueda" ON "productos_presentaciones"("codigo_barras") WHERE ((deleted_at IS NULL) AND (codigo_barras IS NOT NULL));

-- CreateIndex
CREATE INDEX "idx_productos_presentaciones_botica_id" ON "productos_presentaciones"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_proveedores_ruc_activo" ON "proveedores"("ruc") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_proveedores_botica_id" ON "proveedores"("botica_id");

-- CreateIndex
CREATE INDEX "idx_rol_permisos_botica_id" ON "rol_permisos"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_roles_nombre_activo" ON "roles"("nombre") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_roles_botica_id" ON "roles"("botica_id");

-- CreateIndex
CREATE INDEX "idx_sucursales_botica_id" ON "sucursales"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_tipos_mov_codigo_activo" ON "tipos_movimientos_inventario"("codigo") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_tipos_mov_botica_id" ON "tipos_movimientos_inventario"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_unidades_presentacion_nombre_activo" ON "unidades_presentacion"("nombre") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "idx_unidades_presentacion_abrev_activo" ON "unidades_presentacion"("abreviatura") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_unidades_presentacion_botica_id" ON "unidades_presentacion"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_usuarios_correo_activo" ON "usuarios"("correo") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_usuarios_botica_id" ON "usuarios"("botica_id");

-- CreateIndex
CREATE INDEX "idx_migracion_log_botica_id" ON "migracion_log"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_usuario_sucursales_principal_unico" ON "usuario_sucursales"("usuario_id") WHERE ((es_principal = true) AND (activo = true));

-- CreateIndex
CREATE INDEX "idx_usuario_sucursales_botica_id" ON "usuario_sucursales"("botica_id");

-- CreateIndex
CREATE INDEX "idx_usuario_sucursales_sucursal" ON "usuario_sucursales"("sucursal_id", "activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_usuario_sucursales_usuario" ON "usuario_sucursales"("usuario_id", "activo") WHERE (activo = true);

-- CreateIndex
CREATE INDEX "idx_historial_precios_botica_id" ON "historial_precios"("botica_id");

-- CreateIndex
CREATE INDEX "idx_historial_precios_producto" ON "historial_precios"("producto_presentacion_id");

-- CreateIndex
CREATE INDEX "idx_series_documentos_botica_id" ON "series_documentos"("botica_id");

-- CreateIndex
CREATE UNIQUE INDEX "series_documentos_serie_unica" ON "series_documentos"("serie", "tipo_documento", "sucursal_id");

-- CreateIndex
CREATE INDEX "idx_ventas_botica_id" ON "ventas"("botica_id");

-- CreateIndex
CREATE INDEX "idx_ventas_caja_id" ON "ventas"("caja_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_ventas_cliente_id" ON "ventas"("cliente_id") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_ventas_fecha" ON "ventas"("fecha") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE INDEX "idx_ventas_usuario_id" ON "ventas"("usuario_id") WHERE (deleted_at IS NULL);

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_compras" ADD CONSTRAINT "detalles_compras_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_compras" ADD CONSTRAINT "detalles_compras_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_compras" ADD CONSTRAINT "detalles_compras_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_compras" ADD CONSTRAINT "detalles_compras_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_compras" ADD CONSTRAINT "detalles_compras_producto_presentacion_id_fkey" FOREIGN KEY ("producto_presentacion_id") REFERENCES "productos_presentaciones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_compras" ADD CONSTRAINT "detalles_compras_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_ventas" ADD CONSTRAINT "detalles_ventas_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_ventas" ADD CONSTRAINT "detalles_ventas_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_ventas" ADD CONSTRAINT "detalles_ventas_producto_presentacion_id_fkey" FOREIGN KEY ("producto_presentacion_id") REFERENCES "productos_presentaciones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_ventas" ADD CONSTRAINT "detalles_ventas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_ventas" ADD CONSTRAINT "detalles_ventas_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_ventas" ADD CONSTRAINT "detalles_ventas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_ventas" ADD CONSTRAINT "detalles_ventas_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "formas_farmaceuticas" ADD CONSTRAINT "formas_farmaceuticas_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "formas_farmaceuticas" ADD CONSTRAINT "formas_farmaceuticas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "formas_farmaceuticas" ADD CONSTRAINT "formas_farmaceuticas_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "formas_farmaceuticas" ADD CONSTRAINT "formas_farmaceuticas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "laboratorios" ADD CONSTRAINT "laboratorios_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "laboratorios" ADD CONSTRAINT "laboratorios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "laboratorios" ADD CONSTRAINT "laboratorios_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "laboratorios" ADD CONSTRAINT "laboratorios_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_detalle_compra_id_fkey" FOREIGN KEY ("detalle_compra_id") REFERENCES "detalles_compras"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_producto_comercial_id_fkey" FOREIGN KEY ("producto_comercial_id") REFERENCES "productos_comerciales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_forma_farmaceutica_id_fkey" FOREIGN KEY ("forma_farmaceutica_id") REFERENCES "formas_farmaceuticas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_principio_activo_id_fkey" FOREIGN KEY ("principio_activo_id") REFERENCES "principios_activos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medicamentos" ADD CONSTRAINT "medicamentos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "metodos_pago" ADD CONSTRAINT "metodos_pago_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_tipo_movimiento_id_fkey" FOREIGN KEY ("tipo_movimiento_id") REFERENCES "tipos_movimientos_inventario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "permisos" ADD CONSTRAINT "permisos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "principios_activos" ADD CONSTRAINT "principios_activos_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "principios_activos" ADD CONSTRAINT "principios_activos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "principios_activos" ADD CONSTRAINT "principios_activos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "principios_activos" ADD CONSTRAINT "principios_activos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_comerciales" ADD CONSTRAINT "productos_comerciales_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_comerciales" ADD CONSTRAINT "productos_comerciales_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_comerciales" ADD CONSTRAINT "productos_comerciales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_comerciales" ADD CONSTRAINT "productos_comerciales_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_comerciales" ADD CONSTRAINT "productos_comerciales_laboratorio_id_fkey" FOREIGN KEY ("laboratorio_id") REFERENCES "laboratorios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_comerciales" ADD CONSTRAINT "productos_comerciales_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamentos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_comerciales" ADD CONSTRAINT "productos_comerciales_unidad_base_id_fkey" FOREIGN KEY ("unidad_base_id") REFERENCES "unidades_presentacion"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_comerciales" ADD CONSTRAINT "productos_comerciales_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_presentaciones" ADD CONSTRAINT "productos_presentaciones_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_presentaciones" ADD CONSTRAINT "productos_presentaciones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_presentaciones" ADD CONSTRAINT "productos_presentaciones_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_presentaciones" ADD CONSTRAINT "productos_presentaciones_producto_comercial_id_fkey" FOREIGN KEY ("producto_comercial_id") REFERENCES "productos_comerciales"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_presentaciones" ADD CONSTRAINT "productos_presentaciones_unidad_presentacion_id_fkey" FOREIGN KEY ("unidad_presentacion_id") REFERENCES "unidades_presentacion"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "productos_presentaciones" ADD CONSTRAINT "productos_presentaciones_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sucursales" ADD CONSTRAINT "sucursales_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tipos_movimientos_inventario" ADD CONSTRAINT "tipos_movimientos_inventario_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tipos_movimientos_inventario" ADD CONSTRAINT "tipos_movimientos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tipos_movimientos_inventario" ADD CONSTRAINT "tipos_movimientos_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tipos_movimientos_inventario" ADD CONSTRAINT "tipos_movimientos_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidades_presentacion" ADD CONSTRAINT "unidades_presentacion_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidades_presentacion" ADD CONSTRAINT "unidades_presentacion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidades_presentacion" ADD CONSTRAINT "unidades_presentacion_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidades_presentacion" ADD CONSTRAINT "unidades_presentacion_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "migracion_log" ADD CONSTRAINT "migracion_log_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "usuario_sucursales_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "fk_sucursal" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "fk_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "fk_created_by" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "usuario_sucursales_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_sucursales" ADD CONSTRAINT "fk_updated_by" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_precios" ADD CONSTRAINT "historial_precios_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_precios" ADD CONSTRAINT "historial_precios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_precios" ADD CONSTRAINT "historial_precios_producto_presentacion_id_fkey" FOREIGN KEY ("producto_presentacion_id") REFERENCES "productos_presentaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "series_documentos" ADD CONSTRAINT "series_documentos_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_caja_id_fkey" FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
