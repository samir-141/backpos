-- ============================================================================
-- SCRIPT DE ROW LEVEL SECURITY (RLS) — POS Farmacia Multi-Tenant
-- ============================================================================
-- Este script define la seguridad a nivel de filas (RLS) en PostgreSQL/Supabase.
-- Requiere que la aplicación fije en cada transacción/sesión la variable:
--   SET LOCAL app.botica_id = '<uuid-de-la-botica>';
--
-- Para usuarios Superadministradores de la plataforma global:
--   SET LOCAL app.is_super_admin = 'true';
-- ============================================================================

-- 1. Función auxiliar para verificar si la sesión actual es de un Superadministrador
CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.is_super_admin', true) = 'true', false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Función auxiliar para obtener el tenant (botica_id) de la sesión activa
CREATE OR REPLACE FUNCTION current_botica_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.botica_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. HABILITACIÓN DE RLS Y CREACIÓN DE POLÍTICAS POR TABLA
-- ============================================================================

-- EMPRESAS (BOTICAS)
ALTER TABLE "empresas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresas_tenant_isolation" ON "empresas";
CREATE POLICY "empresas_tenant_isolation" ON "empresas"
  FOR ALL
  USING (
    is_platform_super_admin() OR id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR id = current_botica_id()
  );

-- SUCURSALES
ALTER TABLE "sucursales" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sucursales_tenant_isolation" ON "sucursales";
CREATE POLICY "sucursales_tenant_isolation" ON "sucursales"
  FOR ALL
  USING (
    is_platform_super_admin() OR empresa_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR empresa_id = current_botica_id()
  );

-- USUARIOS
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usuarios_tenant_isolation" ON "usuarios";
CREATE POLICY "usuarios_tenant_isolation" ON "usuarios"
  FOR ALL
  USING (
    is_platform_super_admin() 
    OR botica_id = current_botica_id()
    OR (botica_id IS NULL AND es_super_admin = true)
  )
  WITH CHECK (
    is_platform_super_admin() 
    OR botica_id = current_botica_id()
  );

-- PRODUCTOS COMERCIALES
ALTER TABLE "productos_comerciales" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "productos_comerciales_tenant_isolation" ON "productos_comerciales";
CREATE POLICY "productos_comerciales_tenant_isolation" ON "productos_comerciales"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- PRODUCTOS PRESENTACIONES
ALTER TABLE "productos_presentaciones" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "productos_presentaciones_tenant_isolation" ON "productos_presentaciones";
CREATE POLICY "productos_presentaciones_tenant_isolation" ON "productos_presentaciones"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- LOTES
ALTER TABLE "lotes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lotes_tenant_isolation" ON "lotes";
CREATE POLICY "lotes_tenant_isolation" ON "lotes"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- VENTAS
ALTER TABLE "ventas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ventas_tenant_isolation" ON "ventas";
CREATE POLICY "ventas_tenant_isolation" ON "ventas"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- DETALLES VENTAS
ALTER TABLE "detalles_ventas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detalles_ventas_tenant_isolation" ON "detalles_ventas";
CREATE POLICY "detalles_ventas_tenant_isolation" ON "detalles_ventas"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- DETALLE VENTA LOTES
ALTER TABLE "detalle_venta_lotes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detalle_venta_lotes_tenant_isolation" ON "detalle_venta_lotes";
CREATE POLICY "detalle_venta_lotes_tenant_isolation" ON "detalle_venta_lotes"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- COMPRAS
ALTER TABLE "compras" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compras_tenant_isolation" ON "compras";
CREATE POLICY "compras_tenant_isolation" ON "compras"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- DETALLES COMPRAS
ALTER TABLE "detalles_compras" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detalles_compras_tenant_isolation" ON "detalles_compras";
CREATE POLICY "detalles_compras_tenant_isolation" ON "detalles_compras"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- PROVEEDORES
ALTER TABLE "proveedores" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proveedores_tenant_isolation" ON "proveedores";
CREATE POLICY "proveedores_tenant_isolation" ON "proveedores"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- CAJAS
ALTER TABLE "cajas" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cajas_tenant_isolation" ON "cajas";
CREATE POLICY "cajas_tenant_isolation" ON "cajas"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- MOVIMIENTOS CAJA
ALTER TABLE "movimientos_caja" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movimientos_caja_tenant_isolation" ON "movimientos_caja";
CREATE POLICY "movimientos_caja_tenant_isolation" ON "movimientos_caja"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- GASTOS
ALTER TABLE "gastos_operativos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gastos_operativos_tenant_isolation" ON "gastos_operativos";
CREATE POLICY "gastos_operativos_tenant_isolation" ON "gastos_operativos"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- CLIENTES
ALTER TABLE "clientes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_tenant_isolation" ON "clientes";
CREATE POLICY "clientes_tenant_isolation" ON "clientes"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- SERIES DOCUMENTOS
ALTER TABLE "series_documentos" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "series_documentos_tenant_isolation" ON "series_documentos";
CREATE POLICY "series_documentos_tenant_isolation" ON "series_documentos"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );

-- MOVIMIENTOS INVENTARIO
ALTER TABLE "movimientos_inventario" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movimientos_inventario_tenant_isolation" ON "movimientos_inventario";
CREATE POLICY "movimientos_inventario_tenant_isolation" ON "movimientos_inventario"
  FOR ALL
  USING (
    is_platform_super_admin() OR botica_id = current_botica_id()
  )
  WITH CHECK (
    is_platform_super_admin() OR botica_id = current_botica_id()
  );
