-- ============================================================
-- GESTOR CUPVICSON — Row Level Security (RLS) Policies
-- ============================================================
-- Ejecutar este script en el SQL Editor de Supabase DESPUÉS
-- de haber creado el schema (schema_supabase.sql).
--
-- Modelo de acceso:
--   admin    → acceso total a todas las sucursales
--   gerente  → acceso completo a su sucursal asignada
--   operador → lectura general + escritura limitada (sin DELETE)
-- ============================================================

-- -------------------------------------------------------
-- FUNCIONES HELPER (SECURITY DEFINER para evitar RLS recursivo)
-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION auth_user_rol()
RETURNS TEXT AS $$
  SELECT rol FROM user_sucursal WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_user_sucursal_id()
RETURNS UUID AS $$
  SELECT sucursal_id FROM user_sucursal WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- -------------------------------------------------------
-- 1. USER_SUCURSAL (tabla de roles)
-- -------------------------------------------------------
ALTER TABLE user_sucursal ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve solo su propio registro
CREATE POLICY "user_sucursal_select_own" ON user_sucursal
  FOR SELECT USING (user_id = auth.uid());

-- Admins pueden ver todos los registros
CREATE POLICY "user_sucursal_select_admin" ON user_sucursal
  FOR SELECT USING (auth_user_rol() = 'admin');

-- Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "user_sucursal_admin_all" ON user_sucursal
  FOR ALL USING (auth_user_rol() = 'admin');

-- -------------------------------------------------------
-- 2. EMPRESAS
-- -------------------------------------------------------
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden ver empresas
CREATE POLICY "empresas_select_all" ON empresas
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo admins pueden modificar empresas
CREATE POLICY "empresas_admin_write" ON empresas
  FOR ALL USING (auth_user_rol() = 'admin');

-- -------------------------------------------------------
-- 3. SUCURSALES
-- -------------------------------------------------------
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;

-- Admin ve todas las sucursales
CREATE POLICY "sucursales_select_admin" ON sucursales
  FOR SELECT USING (auth_user_rol() = 'admin');

-- Gerentes y operadores ven solo su sucursal
CREATE POLICY "sucursales_select_own" ON sucursales
  FOR SELECT USING (id = auth_user_sucursal_id());

-- Solo admins pueden crear/modificar/eliminar sucursales
CREATE POLICY "sucursales_admin_write" ON sucursales
  FOR ALL USING (auth_user_rol() = 'admin');

-- -------------------------------------------------------
-- 4. CONTRATOS
-- -------------------------------------------------------
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

-- Admin ve todos los contratos
CREATE POLICY "contratos_select_admin" ON contratos
  FOR SELECT USING (auth_user_rol() = 'admin');

-- Gerentes y operadores ven contratos de su sucursal
CREATE POLICY "contratos_select_own" ON contratos
  FOR SELECT USING (sucursal_id = auth_user_sucursal_id());

-- Admins tienen acceso total
CREATE POLICY "contratos_admin_write" ON contratos
  FOR ALL USING (auth_user_rol() = 'admin');

-- Gerentes pueden crear/actualizar contratos de su sucursal
CREATE POLICY "contratos_gerente_write" ON contratos
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'gerente'
    AND sucursal_id = auth_user_sucursal_id()
  );

CREATE POLICY "contratos_gerente_update" ON contratos
  FOR UPDATE USING (
    auth_user_rol() = 'gerente'
    AND sucursal_id = auth_user_sucursal_id()
  );

-- -------------------------------------------------------
-- 5. SERVICIOS (catálogo global)
-- -------------------------------------------------------
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver el catálogo
CREATE POLICY "servicios_select_all" ON servicios
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo admins modifican el catálogo
CREATE POLICY "servicios_admin_write" ON servicios
  FOR ALL USING (auth_user_rol() = 'admin');

-- -------------------------------------------------------
-- 6. CATEGORIAS_SERVICIO
-- -------------------------------------------------------
ALTER TABLE categorias_servicio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_select_all" ON categorias_servicio
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "categorias_admin_write" ON categorias_servicio
  FOR ALL USING (auth_user_rol() = 'admin');

-- -------------------------------------------------------
-- 7. CUP_DIARIO
-- -------------------------------------------------------
ALTER TABLE cup_diario ENABLE ROW LEVEL SECURITY;

-- Admin ve todo
CREATE POLICY "cup_diario_select_admin" ON cup_diario
  FOR SELECT USING (auth_user_rol() = 'admin');

-- Gerentes y operadores ven CUP de contratos de su sucursal
CREATE POLICY "cup_diario_select_own" ON cup_diario
  FOR SELECT USING (
    contrato_id IN (
      SELECT id FROM contratos
      WHERE sucursal_id = auth_user_sucursal_id()
    )
  );

-- Admins: acceso total
CREATE POLICY "cup_diario_admin_write" ON cup_diario
  FOR ALL USING (auth_user_rol() = 'admin');

-- Gerentes: pueden crear y actualizar
CREATE POLICY "cup_diario_gerente_insert" ON cup_diario
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'gerente'
    AND contrato_id IN (
      SELECT id FROM contratos WHERE sucursal_id = auth_user_sucursal_id()
    )
  );

CREATE POLICY "cup_diario_gerente_update" ON cup_diario
  FOR UPDATE USING (
    auth_user_rol() = 'gerente'
    AND contrato_id IN (
      SELECT id FROM contratos WHERE sucursal_id = auth_user_sucursal_id()
    )
  );

-- Operadores: solo insertar (sin delete/update)
CREATE POLICY "cup_diario_operador_insert" ON cup_diario
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'operador'
    AND contrato_id IN (
      SELECT id FROM contratos WHERE sucursal_id = auth_user_sucursal_id()
    )
  );

-- -------------------------------------------------------
-- 8. OBJETIVO_CUP
-- -------------------------------------------------------
ALTER TABLE objetivo_cup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objetivo_cup_select_admin" ON objetivo_cup
  FOR SELECT USING (auth_user_rol() = 'admin');

CREATE POLICY "objetivo_cup_select_own" ON objetivo_cup
  FOR SELECT USING (
    contrato_id IN (
      SELECT id FROM contratos WHERE sucursal_id = auth_user_sucursal_id()
    )
  );

CREATE POLICY "objetivo_cup_admin_write" ON objetivo_cup
  FOR ALL USING (auth_user_rol() = 'admin');

CREATE POLICY "objetivo_cup_gerente_write" ON objetivo_cup
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'gerente'
    AND contrato_id IN (
      SELECT id FROM contratos WHERE sucursal_id = auth_user_sucursal_id()
    )
  );

-- -------------------------------------------------------
-- 9. GUIAS_FACT (facturación)
-- -------------------------------------------------------
ALTER TABLE guias_fact ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guias_fact_select_admin" ON guias_fact
  FOR SELECT USING (auth_user_rol() = 'admin');

CREATE POLICY "guias_fact_select_own" ON guias_fact
  FOR SELECT USING (sucursal_id = auth_user_sucursal_id());

CREATE POLICY "guias_fact_admin_write" ON guias_fact
  FOR ALL USING (auth_user_rol() = 'admin');

CREATE POLICY "guias_fact_gerente_insert" ON guias_fact
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'gerente'
    AND sucursal_id = auth_user_sucursal_id()
  );

CREATE POLICY "guias_fact_gerente_update" ON guias_fact
  FOR UPDATE USING (
    auth_user_rol() = 'gerente'
    AND sucursal_id = auth_user_sucursal_id()
  );

-- -------------------------------------------------------
-- 10. GUIAS_DETALLE
-- -------------------------------------------------------
ALTER TABLE guias_detalle ENABLE ROW LEVEL SECURITY;

-- Puede ver el detalle si puede ver la guía padre
CREATE POLICY "guias_detalle_select" ON guias_detalle
  FOR SELECT USING (
    guia_id IN (
      SELECT id FROM guias_fact
      WHERE auth_user_rol() = 'admin'
         OR sucursal_id = auth_user_sucursal_id()
    )
  );

CREATE POLICY "guias_detalle_admin_write" ON guias_detalle
  FOR ALL USING (auth_user_rol() = 'admin');

CREATE POLICY "guias_detalle_gerente_write" ON guias_detalle
  FOR INSERT WITH CHECK (
    auth_user_rol() IN ('gerente', 'operador')
    AND guia_id IN (
      SELECT id FROM guias_fact WHERE sucursal_id = auth_user_sucursal_id()
    )
  );

-- -------------------------------------------------------
-- 11. CLIENTES
-- -------------------------------------------------------
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select_all" ON clientes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "clientes_admin_write" ON clientes
  FOR ALL USING (auth_user_rol() = 'admin');

CREATE POLICY "clientes_gerente_write" ON clientes
  FOR INSERT WITH CHECK (auth_user_rol() IN ('admin', 'gerente'));

-- -------------------------------------------------------
-- 12. REEMBOLSABLES
-- -------------------------------------------------------
ALTER TABLE reembolsables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reembolsables_select_admin" ON reembolsables
  FOR SELECT USING (auth_user_rol() = 'admin');

CREATE POLICY "reembolsables_select_own" ON reembolsables
  FOR SELECT USING (sucursal_id = auth_user_sucursal_id());

CREATE POLICY "reembolsables_admin_write" ON reembolsables
  FOR ALL USING (auth_user_rol() = 'admin');

CREATE POLICY "reembolsables_gerente_write" ON reembolsables
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'gerente'
    AND sucursal_id = auth_user_sucursal_id()
  );

CREATE POLICY "reembolsables_gerente_update" ON reembolsables
  FOR UPDATE USING (
    auth_user_rol() = 'gerente'
    AND sucursal_id = auth_user_sucursal_id()
  );

CREATE POLICY "reembolsables_operador_insert" ON reembolsables
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'operador'
    AND sucursal_id = auth_user_sucursal_id()
  );

-- -------------------------------------------------------
-- 13. PROVEEDORES
-- -------------------------------------------------------
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_select_all" ON proveedores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "proveedores_admin_write" ON proveedores
  FOR ALL USING (auth_user_rol() = 'admin');

-- -------------------------------------------------------
-- 14. PRODUCTOS_REFRI
-- -------------------------------------------------------
ALTER TABLE productos_refri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_refri_select_all" ON productos_refri
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "productos_refri_admin_write" ON productos_refri
  FOR ALL USING (auth_user_rol() = 'admin');

-- -------------------------------------------------------
-- 15. INVENTARIO
-- -------------------------------------------------------
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventario_select_admin" ON inventario
  FOR SELECT USING (auth_user_rol() = 'admin');

CREATE POLICY "inventario_select_own" ON inventario
  FOR SELECT USING (sucursal_id = auth_user_sucursal_id());

CREATE POLICY "inventario_admin_write" ON inventario
  FOR ALL USING (auth_user_rol() = 'admin');

CREATE POLICY "inventario_gerente_write" ON inventario
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'gerente'
    AND sucursal_id = auth_user_sucursal_id()
  );

-- -------------------------------------------------------
-- 16. INVENTARIO_MOV
-- -------------------------------------------------------
ALTER TABLE inventario_mov ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventario_mov_select" ON inventario_mov
  FOR SELECT USING (
    inventario_id IN (
      SELECT id FROM inventario
      WHERE auth_user_rol() = 'admin'
         OR sucursal_id = auth_user_sucursal_id()
    )
  );

CREATE POLICY "inventario_mov_admin_write" ON inventario_mov
  FOR ALL USING (auth_user_rol() = 'admin');

CREATE POLICY "inventario_mov_gerente_write" ON inventario_mov
  FOR INSERT WITH CHECK (
    auth_user_rol() IN ('gerente', 'operador')
    AND inventario_id IN (
      SELECT id FROM inventario WHERE sucursal_id = auth_user_sucursal_id()
    )
  );

-- -------------------------------------------------------
-- 17. TRASPASOS
-- -------------------------------------------------------
ALTER TABLE traspasos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traspasos_select_admin" ON traspasos
  FOR SELECT USING (auth_user_rol() = 'admin');

CREATE POLICY "traspasos_select_own" ON traspasos
  FOR SELECT USING (
    sucursal_origen = auth_user_sucursal_id()
    OR sucursal_destino = auth_user_sucursal_id()
  );

CREATE POLICY "traspasos_admin_write" ON traspasos
  FOR ALL USING (auth_user_rol() = 'admin');

CREATE POLICY "traspasos_gerente_write" ON traspasos
  FOR INSERT WITH CHECK (
    auth_user_rol() = 'gerente'
    AND sucursal_origen = auth_user_sucursal_id()
  );

-- ============================================================
-- INSTRUCCIONES DE APLICACIÓN
-- ============================================================
-- 1. En Supabase Dashboard → SQL Editor, ejecuta este script.
-- 2. Verifica en Authentication → Policies que cada tabla
--    muestra las políticas correctas.
-- 3. Para deshabilitar temporalmente RLS en una tabla (DEBUG):
--    ALTER TABLE nombre_tabla DISABLE ROW LEVEL SECURITY;
-- 4. Para probar una política como otro usuario:
--    SET ROLE authenticated;
--    SET LOCAL "request.jwt.claims" TO '{"sub":"UUID_USUARIO"}';
-- ============================================================
