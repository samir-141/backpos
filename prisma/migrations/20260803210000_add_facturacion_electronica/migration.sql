-- Migración: Facturación Electrónica SUNAT (módulo nuevo, solo objetos nuevos).
-- NOTA: generada manualmente vía `prisma migrate diff` porque la BD de desarrollo
-- presenta drift preexistente respecto al historial (índice metodos_pago, FKs de
-- productos_comerciales, etc.). Esos cambios ajenos fueron EXCLUIDOS a propósito.

-- CreateTable
CREATE TABLE "configuraciones_tributarias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razon_social" VARCHAR(200) NOT NULL,
    "nombre_comercial" VARCHAR(200),
    "codigo_pais" VARCHAR(2) NOT NULL DEFAULT 'PE',
    "ubigeo" VARCHAR(6),
    "departamento" VARCHAR(100),
    "provincia" VARCHAR(100),
    "distrito" VARCHAR(100),
    "direccion_fiscal" VARCHAR(250) NOT NULL,
    "regimen_tributario" VARCHAR(30) NOT NULL,
    "emisor_electronico" BOOLEAN NOT NULL DEFAULT false,
    "ambiente" VARCHAR(20) NOT NULL DEFAULT 'BETA',
    "proveedor_facturacion" VARCHAR(30) NOT NULL DEFAULT 'SUNAT_DIRECTO',
    "sol_usuario_encriptado" TEXT,
    "sol_clave_encriptada" TEXT,
    "certificado_nombre" VARCHAR(200),
    "certificado_path" TEXT,
    "certificado_clave_encriptada" TEXT,
    "certificado_fecha_vencimiento" TIMESTAMPTZ(6),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "configuraciones_tributarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_electronicos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "sucursal_id" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    "cliente_id" UUID,
    "serie_id" UUID NOT NULL,
    "tipo_comprobante" VARCHAR(2) NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "nombre_archivo" VARCHAR(100) NOT NULL,
    "fecha_emision" TIMESTAMPTZ(6) NOT NULL,
    "fecha_vencimiento" TIMESTAMPTZ(6),
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'PEN',
    "forma_pago" VARCHAR(20) NOT NULL DEFAULT 'CONTADO',
    "cliente_tipo_documento" VARCHAR(2),
    "cliente_numero_documento" VARCHAR(20),
    "cliente_razon_social" VARCHAR(200),
    "cliente_direccion" VARCHAR(250),
    "total_gravado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_exonerado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_inafecto" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_gratuito" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_descuentos" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_igv" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "estado" VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE',
    "codigo_respuesta" VARCHAR(20),
    "mensaje_respuesta" TEXT,
    "observaciones" JSONB,
    "hash" TEXT,
    "ticket_sunat" TEXT,
    "xml_path" TEXT,
    "xml_firmado_path" TEXT,
    "zip_path" TEXT,
    "cdr_zip_path" TEXT,
    "cdr_xml_path" TEXT,
    "pdf_path" TEXT,
    "comprobante_referencia_id" UUID,
    "codigo_motivo_nota" VARCHAR(2),
    "descripcion_motivo_nota" VARCHAR(250),
    "enviado_at" TIMESTAMPTZ(6),
    "aceptado_at" TIMESTAMPTZ(6),
    "rechazado_at" TIMESTAMPTZ(6),
    "anulado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "comprobantes_electronicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_electronicos_detalles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comprobante_id" UUID NOT NULL,
    "producto_id" UUID,
    "codigo_producto" VARCHAR(50),
    "codigo_sunat" VARCHAR(20),
    "descripcion" VARCHAR(500) NOT NULL,
    "unidad_medida" VARCHAR(3) NOT NULL,
    "cantidad" DECIMAL(14,6) NOT NULL,
    "valor_unitario" DECIMAL(14,6) NOT NULL,
    "precio_unitario" DECIMAL(14,6) NOT NULL,
    "valor_venta" DECIMAL(15,2) NOT NULL,
    "descuento" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "codigo_afectacion_igv" VARCHAR(2) NOT NULL,
    "porcentaje_igv" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "monto_igv" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "importe_total" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_electronicos_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_intentos_envio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comprobante_id" UUID NOT NULL,
    "numero_intento" INTEGER NOT NULL,
    "ambiente" VARCHAR(20) NOT NULL,
    "endpoint" TEXT,
    "estado" VARCHAR(30) NOT NULL,
    "codigo_http" INTEGER,
    "codigo_respuesta" VARCHAR(20),
    "mensaje_respuesta" TEXT,
    "request_metadata" JSONB,
    "response_metadata" JSONB,
    "iniciado_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_at" TIMESTAMPTZ(6),

    CONSTRAINT "comprobantes_intentos_envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumenes_diarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "botica_id" UUID NOT NULL,
    "sucursal_id" UUID,
    "fecha_referencia" DATE NOT NULL,
    "fecha_generacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identificador" VARCHAR(30) NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    "ticket_sunat" TEXT,
    "codigo_respuesta" VARCHAR(20),
    "mensaje_respuesta" TEXT,
    "observaciones" JSONB,
    "xml_path" TEXT,
    "zip_path" TEXT,
    "cdr_zip_path" TEXT,
    "cdr_xml_path" TEXT,
    "enviado_at" TIMESTAMPTZ(6),
    "procesado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "resumenes_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumenes_diarios_detalles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resumen_id" UUID NOT NULL,
    "comprobante_id" UUID NOT NULL,
    "condicion" VARCHAR(3) NOT NULL,
    "estado_resultado" VARCHAR(30),
    "mensaje_resultado" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumenes_diarios_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_config_tributarias_botica" ON "configuraciones_tributarias"("botica_id");

-- CreateIndex
CREATE INDEX "idx_config_tributarias_ruc" ON "configuraciones_tributarias"("ruc");

-- CreateIndex
CREATE INDEX "idx_comprobantes_electronicos_botica_id" ON "comprobantes_electronicos"("botica_id");

-- CreateIndex
CREATE INDEX "idx_comprobantes_electronicos_emision" ON "comprobantes_electronicos"("botica_id", "sucursal_id", "fecha_emision");

-- CreateIndex
CREATE INDEX "idx_comprobantes_electronicos_estado" ON "comprobantes_electronicos"("estado");

-- CreateIndex
CREATE INDEX "idx_comprobantes_electronicos_venta_id" ON "comprobantes_electronicos"("venta_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comprobantes_electronicos_numero" ON "comprobantes_electronicos"("botica_id", "tipo_comprobante", "serie", "correlativo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_comprobantes_electronicos_venta_tipo" ON "comprobantes_electronicos"("venta_id", "tipo_comprobante");

-- CreateIndex
CREATE INDEX "idx_comprobantes_detalles_comprobante_id" ON "comprobantes_electronicos_detalles"("comprobante_id");

-- CreateIndex
CREATE INDEX "idx_intentos_envio_comprobante_id" ON "comprobantes_intentos_envio"("comprobante_id");

-- CreateIndex
CREATE INDEX "idx_intentos_envio_estado" ON "comprobantes_intentos_envio"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intentos_envio_comprobante_numero" ON "comprobantes_intentos_envio"("comprobante_id", "numero_intento");

-- CreateIndex
CREATE INDEX "idx_resumenes_diarios_botica_id" ON "resumenes_diarios"("botica_id");

-- CreateIndex
CREATE INDEX "idx_resumenes_diarios_fecha" ON "resumenes_diarios"("botica_id", "fecha_referencia");

-- CreateIndex
CREATE INDEX "idx_resumenes_diarios_estado" ON "resumenes_diarios"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "uq_resumenes_diarios_fecha_correlativo" ON "resumenes_diarios"("botica_id", "fecha_referencia", "correlativo");

-- CreateIndex
CREATE INDEX "idx_resumenes_detalles_comprobante_id" ON "resumenes_diarios_detalles"("comprobante_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_resumenes_detalles_resumen_comprobante" ON "resumenes_diarios_detalles"("resumen_id", "comprobante_id");

-- AddForeignKey
ALTER TABLE "configuraciones_tributarias" ADD CONSTRAINT "configuraciones_tributarias_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobantes_electronicos" ADD CONSTRAINT "comprobantes_electronicos_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobantes_electronicos" ADD CONSTRAINT "comprobantes_electronicos_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobantes_electronicos" ADD CONSTRAINT "comprobantes_electronicos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobantes_electronicos" ADD CONSTRAINT "comprobantes_electronicos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobantes_electronicos" ADD CONSTRAINT "comprobantes_electronicos_serie_id_fkey" FOREIGN KEY ("serie_id") REFERENCES "series_documentos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobantes_electronicos" ADD CONSTRAINT "comprobantes_electronicos_comprobante_referencia_id_fkey" FOREIGN KEY ("comprobante_referencia_id") REFERENCES "comprobantes_electronicos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobantes_electronicos_detalles" ADD CONSTRAINT "comprobantes_electronicos_detalles_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "comprobantes_electronicos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobantes_intentos_envio" ADD CONSTRAINT "comprobantes_intentos_envio_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "comprobantes_electronicos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resumenes_diarios" ADD CONSTRAINT "resumenes_diarios_botica_id_fkey" FOREIGN KEY ("botica_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resumenes_diarios" ADD CONSTRAINT "resumenes_diarios_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursales"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resumenes_diarios_detalles" ADD CONSTRAINT "resumenes_diarios_detalles_resumen_id_fkey" FOREIGN KEY ("resumen_id") REFERENCES "resumenes_diarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resumenes_diarios_detalles" ADD CONSTRAINT "resumenes_diarios_detalles_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "comprobantes_electronicos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
