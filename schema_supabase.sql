-- ============================================================
-- SUPABASE SQL SCHEMA — Web App Gestión Gastronómica Multi-Sucursal
-- Empresa: VICSON SA | Sucursal: VICSON VALENCIA
-- Contexto: migración desde Excel (CUP, Guías, CFC, RG, PxF, Inventario, RECOP)
-- Fecha: mayo 2017 — diseño genérico para cualquier periodo/sucursal
-- ============================================================

-- -------------------------------------------------------
-- 1. EMPRESAS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  rif           TEXT,
  telefono      TEXT,
  direccion     TEXT,
  email         TEXT,
  estado        TEXT DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 2. SUCURSALES  (35 sucursales según RECOP; campocodigo tipo "023")
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sucursales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  codigo        TEXT NOT NULL,             -- ej: "023", "005"
  direccion    TEXT,
  rif           TEXT,
  telefono      TEXT,
  responsable   TEXT,
  estado        TEXT DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id, codigo)
);

-- -------------------------------------------------------
-- 3. CONTRATOS  (CUP: Contrato de Uso de Planta)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id   UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  responsable   TEXT,
  telefono      TEXT,
  email         TEXT,
  estado        TEXT DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','vencido')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 4. CATEGORIAS DE SERVICIO  (ej:"COMEDOR","CAFE","REFRIGERIO")
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_servicio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL UNIQUE,
  descripcion   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 5. SERVICIOS  (300001..300006 etc. — códigos de facturación)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS servicios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        TEXT NOT NULL UNIQUE,
  nombre        TEXT NOT NULL,
  categoria_id  UUID REFERENCES categorias_servicio(id),
  indicador     TEXT CHECK (indicador IN ('E','G','')),   -- (E)=prestado / (G)=no prestado
  grupo         TEXT,                                      -- ej:"Alimentación","Reembolsables","Otros"
  precio_vigente DECIMAL(15,2),
  descripcion   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 6. OBJETIVO_CUP  (meta diaria por servicio para un contrato)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS objetivo_cup (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id   UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  servicio_id   UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  anio          INTEGER NOT NULL,
  mes           INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fecha         DATE,
  meta          DECIMAL(15,6),         -- % de cumplimiento esperado (ej 0.55)
  precio        DECIMAL(15,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_id, servicio_id, anio, mes)
);

-- -------------------------------------------------------
-- 7. CUP_DIARIO  (reporte diario CUP — ventas por servicio)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS cup_diario (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id     UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  dia_semana      TEXT,
  sobrecena       DECIMAL(15,2),
  desayuno        DECIMAL(15,2),
  almuerzo        DECIMAL(15,2),
  cena            DECIMAL(15,2),
  refrigerios     DECIMAL(15,2),
  merienda_1      DECIMAL(15,2),
  merienda_2      DECIMAL(15,2),
  efectivo        DECIMAL(15,2),
  cafetin         DECIMAL(15,2),
  otros           DECIMAL(15,2),
  total_venta     DECIMAL(15,2),
  costo_insumos   DECIMAL(15,2),       -- Alimentos Bs.
  desechables     DECIMAL(15,2),       -- Desechables/Limpieza Bs.
  costo_cup       DECIMAL(15,2),       -- Costo diario CUP
  costo_personal  DECIMAL(15,2),       -- Costo diario personal
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_id, fecha)
);

-- -------------------------------------------------------
-- 8. VENTA_COMENSAL  (Fichas: almuerzo/cena por día)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta_comensal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cup_id          UUID NOT NULL REFERENCES cup_diario(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  dia             TEXT,                     -- L,M,M,J,V,S,D
  n_almuerzo      INTEGER,
  precio_alm      DECIMAL(15,2),
  subtotal_alm    DECIMAL(15,2),
  n_cena          INTEGER,
  precio_cena     DECIMAL(15,2),
  subtotal_cena   DECIMAL(15,2),
  total_general   DECIMAL(15,2),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cup_id, fecha)
);

-- -------------------------------------------------------
-- 9. PRODUCTOS_REFri  (catálogo de refrigerios)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos_refri (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  codigo        TEXT,
  categoria     TEXT,                     -- ej:"JUGOS","SANDWICH","PASAPALOS"
  precio        DECIMAL(15,2),
  unidad        TEXT,
  stock_minimo  DECIMAL(15,2) DEFAULT 0,
  estado        TEXT DEFAULT 'activo',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 10. REFRI_DIARIO  (refrigerios vendidos por día)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS refri_diario (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cup_id        UUID NOT NULL REFERENCES cup_diario(id) ON DELETE CASCADE,
  producto_id   UUID NOT NULL REFERENCES productos_refri(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  cantidad      DECIMAL(15,2) DEFAULT 0,
  importe       DECIMAL(15,2) DEFAULT 0,
  UNIQUE(cup_id, producto_id, fecha)
);

-- -------------------------------------------------------
-- 11. VENTA_TERMO  (café / leche — térmo)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta_termo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cup_id        UUID NOT NULL REFERENCES cup_diario(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  tipo          TEXT CHECK (tipo IN ('TERMO_CAFE','TERMO_LECHE')),
  cantidad      DECIMAL(15,2) DEFAULT 0,
  precio        DECIMAL(15,2),
  total         DECIMAL(15,2) DEFAULT 0,
  UNIQUE(cup_id, fecha, tipo)
);

-- -------------------------------------------------------
-- 12. CLIENTES  (companies que contratan servicios)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID REFERENCES empresas(id),
  nombre        TEXT NOT NULL,
  rif           TEXT,
  telefono      TEXT,
  email         TEXT,
  contacto_nombre TEXT,
  contacto_cargo  TEXT,
  contacto_tel    TEXT,
  direccion     TEXT,
  estado        TEXT DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 13. GUIAS_FACT  (facturas/guías de facturación)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS guias_fact (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  numero_guia     TEXT NOT NULL,               -- ej:"FF-005-01"
  fecha           DATE NOT NULL,
  periodo_ini     DATE,
  periodo_fin     DATE,
  no_oc           TEXT,
  factura_n       TEXT,
  estado          TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','facturada','pagada','anulada')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, numero_guia)
);

-- -------------------------------------------------------
-- 14. GUIAS_DETALLE  (líneas de servicio dentro de una guía)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS guias_detalle (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id       UUID NOT NULL REFERENCES guias_fact(id) ON DELETE CASCADE,
  servicio_id   UUID NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  cantidad      DECIMAL(15,2) NOT NULL DEFAULT 1,
  precio_unit   DECIMAL(15,2) NOT NULL,
  importe       DECIMAL(15,2) NOT NULL,
  orden         INTEGER DEFAULT 0,
  UNIQUE(guia_id, servicio_id, orden)
);

-- -------------------------------------------------------
-- 15. PROVEEDORES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  rif           TEXT,
  telefono      TEXT,
  email         TEXT,
  direccion     TEXT,
  estado        TEXT DEFAULT 'activo',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 16. REEMBOLSABLES  (gastos reembolsables a proveedores)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS reembolsables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  ceco            TEXT,
  cuenta_contable TEXT,                        -- ej:"61701125 - Gastos reembolsables"
  factura_n       TEXT,
  detalle         TEXT,
  costo_total     DECIMAL(15,2) NOT NULL,      -- S/IVA
  iva             DECIMAL(15,2) DEFAULT 0,    -- Monto IVA
  total_iva       DECIMAL(15,2),               -- Costo + IVA
  categoria       TEXT,                         -- categoria de gasto
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, factura_n)
);

-- -------------------------------------------------------
-- 17. CFC  (Control de Facturas de Compras)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS cfc (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  cfc_n           INTEGER NOT NULL,             -- número de CFC (1..5)
  fecha_doc       DATE NOT NULL,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  documento_n     TEXT NOT NULL,                -- número de factura del proveedor
  nota_recepcion  TEXT,
  alimentos       DECIMAL(15,2) DEFAULT 0,     -- cuenta 51102013
  desechables     DECIMAL(15,2) DEFAULT 0,     -- cuenta 51102014
  reembolsables   DECIMAL(15,2) DEFAULT 0,     -- cuenta 61701125
  varios          DECIMAL(15,2) DEFAULT 0,     -- otros gastos
  subtotal        DECIMAL(15,2) NOT NULL,
  descuentos      DECIMAL(15,2) DEFAULT 0,
  monto_iva       DECIMAL(15,2) DEFAULT 0,
  total_iva       DECIMAL(15,2) NOT NULL,      -- Subtotal + IVA
  cuenta_contable TEXT,                         -- cuenta contable asociada
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, cfc_n, documento_n)
);

-- -------------------------------------------------------
-- 18. RG  (Relaciones de Gastos)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rg (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  rg_n            INTEGER NOT NULL,
  fecha_doc       DATE NOT NULL,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  documento_n     TEXT,
  alimentos       DECIMAL(15,2) DEFAULT 0,
  desechables     DECIMAL(15,2) DEFAULT 0,
  reembolsables   DECIMAL(15,2) DEFAULT 0,
  varios          DECIMAL(15,2) DEFAULT 0,
  subtotal        DECIMAL(15,2) NOT NULL,
  descuentos      DECIMAL(15,2) DEFAULT 0,
  monto_iva       DECIMAL(15,2) DEFAULT 0,
  total_iva       DECIMAL(15,2) NOT NULL,
  cuenta_contable TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, rg_n, documento_n)
);

-- -------------------------------------------------------
-- 19. PX  (Próximos Pagos / PxF)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS px (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  numero_doc      TEXT NOT NULL,
  fecha           DATE NOT NULL,
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  monto           DECIMAL(15,2) NOT NULL,
  cuenta          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, numero_doc)
);

-- -------------------------------------------------------
-- 20. INVENTARIO  (catálogo de inventario por sucursal)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventario (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  codigo          TEXT,
  categoria       TEXT,
  subcategoria    TEXT,
  unidad          TEXT,
  costo_unit      DECIMAL(15,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 21. INVENTARIO_MOV  (movimientos de inventario: entradas/salidas)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventario_mov (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id   UUID NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  tipo_mov        TEXT NOT NULL CHECK (tipo_mov IN ('entrada','salida','ajuste','inicial','cierre')),
  fecha           DATE NOT NULL,
  cantidad        DECIMAL(15,2) NOT NULL,
  usuario_id      UUID,                         -- FK a auth.users (opcional)
  observacion     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 22. TRASPASOS  (transferencias entre sucursales/cajas)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS traspasos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_origen UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  sucursal_destino UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  monto           DECIMAL(15,2) NOT NULL,
  motivo          TEXT,
  estado          TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','anulado')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CHECK (sucursal_origen != sucursal_destino)
);

-- -------------------------------------------------------
-- 23. NOMINA_CAMBIOS  (registro de nómina y costos de personal)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS nomina_cambios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id     UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  tipo            TEXT CHECK (tipo IN ('quincena_1','quincena_2','otros')),
  monto           DECIMAL(15,2) NOT NULL,
  observacion     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 24. ESTABLECIMIENTOS  (lista de las 35 sucursales conectadas)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS establecimientos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  codigo          TEXT NOT NULL,
  direccion       TEXT,
  rif             TEXT,
  sucursal_id     UUID REFERENCES sucursales(id),  -- si esta sucursal tiene sucursal padre
  estado          TEXT DEFAULT 'activo',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(codigo)
);

-- -------------------------------------------------------
-- 25. DIC / RECOP  (Reporte de Cierre Operacional — resumen mensual)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS dic (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  periodo         DATE NOT NULL,                -- primer día del mes
  responsable     TEXT,
  meta_ventas     DECIMAL(15,2),
  resultado       DECIMAL(15,2),
  ventas_bs       DECIMAL(15,2),
  costo_insumos   DECIMAL(15,2),
  costo_personal  DECIMAL(15,2),
  desechables     DECIMAL(15,2),
  costo_cup_pct   DECIMAL(6,4),
  facturacion     DECIMAL(15,2),
  ventas_efectivo DECIMAL(15,2),
  total_cfc       DECIMAL(15,2),
  total_rg        DECIMAL(15,2),
  total_px        DECIMAL(15,2),
  total_trasp     DECIMAL(15,2),
  inventario_ini  DECIMAL(15,2),
  inventario_final DECIMAL(15,2),
  ajustes         DECIMAL(15,2),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, periodo)
);

-- -------------------------------------------------------
-- 26. HEADCOUNT  (plantilla / personal por contrato)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS headcount (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id     UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  fecha_cierre    DATE NOT NULL,
  total_activo    INTEGER NOT NULL DEFAULT 0,
  total_no_activo INTEGER NOT NULL DEFAULT 0,
  observacion     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------
-- 27. FACTURACION_CLIENTE  (detalle de facturación por cliente — RECOP sección II)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS facturacion_cliente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dic_id          UUID NOT NULL REFERENCES dic(id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servicio        TEXT,
  numero_guia     TEXT,
  numero_factura  TEXT,
  monto_facturado DECIMAL(15,2) DEFAULT 0,
  ventas_efectivo DECIMAL(15,2) DEFAULT 0,
  UNIQUE(dic_id, cliente_id)
);

-- -------------------------------------------------------
-- 28. FACTURACION_SERVICIO  (detalle de facturación por servicio — RECOP sección III)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS facturacion_servicio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dic_id          UUID NOT NULL REFERENCES dic(id) ON DELETE CASCADE,
  servicio        TEXT,
  cantidad        DECIMAL(15,2),
  precio_unitario DECIMAL(15,2),
  total_bs        DECIMAL(15,2) DEFAULT 0,
  UNIQUE(dic_id, servicio)
);

-- -------------------------------------------------------
-- 29. TRASPASOS_RECIBIDOS  (RECOP sección X — servicios recibidos de otras sucursales)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS traspasos_recibidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dic_id          UUID NOT NULL REFERENCES dic(id) ON DELETE CASCADE,
  establecimiento_id UUID NOT NULL REFERENCES establecimientos(id) ON DELETE CASCADE,
  alimentos       DECIMAL(15,2) DEFAULT 0,
  desechables     DECIMAL(15,2) DEFAULT 0,
  servicios       DECIMAL(15,2) DEFAULT 0,
  UNIQUE(dic_id, establecimiento_id)
);

-- -------------------------------------------------------
-- 30. TRASPASOS_EMITIDOS  (RECOP sección XI — servicios emitidos a otras sucursales)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS traspasos_emitidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dic_id          UUID NOT NULL REFERENCES dic(id) ON DELETE CASCADE,
  establecimiento_id UUID NOT NULL REFERENCES establecimientos(id) ON DELETE CASCADE,
  alimentos       DECIMAL(15,2) DEFAULT 0,
  desechables     DECIMAL(15,2) DEFAULT 0,
  servicios       DECIMAL(15,2) DEFAULT 0,
  UNIQUE(dic_id, establecimiento_id)
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX idx_sucursales_empresa ON sucursales(empresa_id);
CREATE INDEX idx_contratos_sucursal ON contratos(sucursal_id);
CREATE INDEX idx_cup_diario_contrato_fecha ON cup_diario(contrato_id, fecha);
CREATE INDEX idx_cup_diario_fecha ON cup_diario(fecha);
CREATE INDEX idx_venta_comensal_cup ON venta_comensal(cup_id);
CREATE INDEX idx_refri_diario_cup ON refri_diario(cup_id);
CREATE INDEX idx_refri_diario_fecha ON refri_diario(fecha);
CREATE INDEX idx_ventra_termo_cup ON venta_termo(cup_id);
CREATE INDEX idx_guias_fact_sucursal ON guias_fact(sucursal_id);
CREATE INDEX idx_guias_fact_cliente ON guias_fact(cliente_id);
CREATE INDEX idx_guias_fact_fecha ON guias_fact(fecha);
CREATE INDEX idx_guias_detalle_guia ON guias_detalle(guia_id);
CREATE INDEX idx_cfc_sucursal ON cfc(sucursal_id);
CREATE INDEX idx_cfc_fecha ON cfc(fecha_doc);
CREATE INDEX idx_cfc_proveedor ON cfc(proveedor_id);
CREATE INDEX idx_rg_sucursal ON rg(sucursal_id);
CREATE INDEX idx_rg_fecha ON rg(fecha_doc);
CREATE INDEX idx_reembolsables_sucursal ON reembolsables(sucursal_id);
CREATE INDEX idx_reembolsables_fecha ON reembolsables(fecha);
CREATE INDEX idx_inventario_sucursal ON inventario(sucursal_id);
CREATE INDEX idx_inventario_mov_inv ON inventario_mov(inventario_id);
CREATE INDEX idx_inventario_mov_fecha ON inventario_mov(fecha);
CREATE INDEX idx_traspasos_fecha ON traspasos(fecha);
CREATE INDEX idx_dic_sucursal ON dic(sucursal_id);
CREATE INDEX idx_dic_periodo ON dic(periodo);
CREATE INDEX idx_facturacion_cliente_dic ON facturacion_cliente(dic_id);
CREATE INDEX idx_facturacion_servicio_dic ON facturacion_servicio(dic_id);
CREATE INDEX idx_tr_recibidos_dic ON traspasos_recibidos(dic_id);
CREATE INDEX idx_tr_emitidos_dic ON traspasos_emitidos(dic_id);
CREATE INDEX idx_nomina_contrato ON nomina_cambios(contrato_id);
CREATE INDEX idx_headcount_contrato ON headcount(contrato_id);
CREATE INDEX idx_establecimientos_codigo ON establecimientos(codigo);
CREATE INDEX idx_servicios_codigo ON servicios(codigo);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas con updated_at
CREATE TRIGGER trg_empresas_updated  AFTER UPDATE ON empresas   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sucursales_updated AFTER UPDATE ON sucursales FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contratos_updated AFTER UPDATE ON contratos   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_servicios_updated  AFTER UPDATE ON servicios  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_objetivo_cup_updated AFTER UPDATE ON objetivo_cup FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cup_diario_updated AFTER UPDATE ON cup_diario  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_venta_comensal_updated AFTER UPDATE ON venta_comensal FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_productos_refri_updated AFTER UPDATE ON productos_refri FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_refri_diario_updated AFTER UPDATE ON refri_diario FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_venta_termo_updated AFTER UPDATE ON venta_termo FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clientes_updated AFTER UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_guias_fact_updated AFTER UPDATE ON guias_fact FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_guias_detalle_updated AFTER UPDATE ON guias_detalle FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_proveedores_updated AFTER UPDATE ON proveedores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reembolsables_updated AFTER UPDATE ON reembolsables FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cfc_updated AFTER UPDATE ON cfc FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rg_updated AFTER UPDATE ON rg FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_px_updated AFTER UPDATE ON px FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventario_updated AFTER UPDATE ON inventario FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_traspasos_updated AFTER UPDATE ON traspasos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_dic_updated AFTER UPDATE ON dic FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_establecimientos_updated AFTER UPDATE ON establecimientos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VISTAS ÚTILES PARA DASHBOARD / REPORTES
-- ============================================================

-- Venta total por día (CUP + comensales + termó + refri)
CREATE OR REPLACE VIEW vista_ventas_diarias AS
SELECT
  cd.id AS cup_id,
  cd.fecha,
  cd.contrato_id,
  s.nombre AS sucursal_nombre,
  c.nombre AS contrato_nombre,
  cd.dia_semana,
  cd.sobrecena,
  cd.desayuno,
  cd.almuerzo,
  cd.cena,
  cd.refrigerios,
  cd.merienda_1,
  cd.merienda_2,
  cd.efectivo,
  cd.cafetin,
  cd.otros,
  cd.total_venta,
  cd.costo_insumos,
  cd.desechables,
  cd.costo_cup,
  -- cálculo de costo total diario
  (cd.costo_insumos + cd.desechables + cd.costo_personal) AS costo_total_dia,
  -- margen
  (cd.total_venta - cd.costo_insumos - cd.desechables - cd.costo_personal) AS margen_dia,
  -- % costo cup (si hay total)
  CASE WHEN cd.total_venta > 0
    THEN (cd.costo_insumos + cd.desechables) / cd.total_venta
    ELSE 0 END AS porcentaje_costo_cup,
  -- comensales
  COALESCE(vc.n_almuerzo,0) AS n_almuerzo,
  COALESCE(vc.n_cena,0) AS n_cena,
  COALESCE(vc.subtotal_alm,0) AS subtotal_alm,
  COALESCE(vc.subtotal_cena,0) AS subtotal_cena,
  COALESCE(vc.total_general,0) AS total_comensales,
  -- acumulado desde inicio de mes hasta esa fecha
  SUM(cd.total_venta) OVER (
    PARTITION BY cd.contrato_id, date_trunc('month', cd.fecha)
    ORDER BY cd.fecha
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS acumulado_venta_mes,
  SUM(cd.costo_insumos + cd.desechables) OVER (
    PARTITION BY cd.contrato_id, date_trunc('month', cd.fecha)
    ORDER BY cd.fecha
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS acumulado_costo_mes
FROM cup_diario cd
LEFT JOIN contratos c ON cd.contrato_id = c.id
LEFT JOIN sucursales s ON c.sucursal_id = s.id
LEFT JOIN venta_comensal vc ON vc.cup_id = cd.id
ORDER BY cd.fecha;

-- Resumen mensual por contrato (similar al RECOP)
CREATE OR REPLACE VIEW vista_resumen_mensual AS
SELECT
  date_trunc('month', cd.fecha)::DATE AS periodo,
  cd.contrato_id,
  c.nombre AS contrato_nombre,
  s.nombre AS sucursal_nombre,
  COUNT(cd.id) AS dias_reportados,
  SUM(cd.total_venta) AS total_ventas_mes,
  SUM(cd.costo_insumos) AS total_costo_insumos,
  SUM(cd.desechables) AS total_desechables,
  SUM(cd.costo_personal) AS total_costo_personal,
  SUM(cd.costo_cup) AS total_costo_cup,
  SUM(cd.total_venta - cd.costo_insumos - cd.desechables - cd.costo_personal) AS margen_neto,
  -- % de costo sobre venta
  CASE WHEN SUM(cd.total_venta) > 0
    THEN SUM(cd.costo_insumos + cd.desechables) / SUM(cd.total_venta)
    ELSE 0 END AS porcentaje_costo_sobre_venta,
  AVG(cd.total_venta) AS promedio_venta_dia,
  AVG(CASE WHEN cd.costo_insumos + cd.desechables > 0
    THEN (cd.costo_insumos + cd.desechables) / cd.total_venta
    ELSE 0 END) AS promedio_costo_cup_pct
FROM cup_diario cd
LEFT JOIN contratos c ON cd.contrato_id = c.id
LEFT JOIN sucursales s ON c.sucursal_id = s.id
GROUP BY periodo, cd.contrato_id, c.nombre, s.nombre
ORDER BY periodo DESC, s.nombre;

-- Recop del mes completo — tipo reporte de cierre
CREATE OR REPLACE VIEW vista_dic_resumen AS
SELECT
  d.id,
  d.periodo,
  s.nombre AS sucursal,
  d.responsable,
  d.meta_ventas,
  d.resultado,
  d.ventas_bs,
  d.costo_insumos,
  d.costo_personal,
  d.desechables,
  d.costo_cup_pct,
  d.facturacion,
  d.ventas_efectivo,
  d.total_cfc,
  d.total_rg,
  d.total_px,
  d.total_trasp,
  d.inventario_ini,
  d.inventario_final,
  d.ajustes,
  (d.inventario_ini + d.total_cfc + d.total_rg + d.total_px +
   COALESCE(SUM(cfc.alimentos + cfc.desechables + cfc.reembolsables + cfc.varios),0) -
   COALESCE(SUM(trp.monto),0)) AS calculo_inventario_teorico
FROM dic d
LEFT JOIN sucursales s ON d.sucursal_id = s.id
LEFT JOIN cfc ON cfc.sucursal_id = d.sucursal_id
LEFT JOIN traspasos trp ON trp.sucursal_origen = d.sucursal_id
GROUP BY d.id, d.periodo, s.nombre, d.responsable, d.meta_ventas, d.resultado,
         d.ventas_bs, d.costo_insumos, d.costo_personal, d.desechables,
         d.costo_cup_pct, d.facturacion, d.ventas_efectivo,
         d.total_cfc, d.total_rg, d.total_px, d.total_trasp,
         d.inventario_ini, d.inventario_final, d.ajustes;

-- Resumen CFC — totales por cuenta contable (como el Resumen CFC del Excel)
CREATE OR REPLACE VIEW vista_resumen_cfc AS
SELECT
  c.cuenta_contable,
  COUNT(c.id) AS documento_count,
  SUM(c.alimentos) AS total_alimentos,
  SUM(c.desechables) AS total_desechables,
  SUM(c.reembolsables) AS total_reembolsables,
  SUM(c.varios) AS total_varios,
  SUM(c.subtotal) AS total_subtotal,
  SUM(c.descuentos) AS total_descuentos,
  SUM(c.monto_iva) AS total_monto_iva,
  SUM(c.total_iva) AS total_con_iva
FROM cfc c
GROUP BY c.cuenta_contable
ORDER BY c.cuenta_contable;

-- Resumen de guías de factura por servicio (tipo RECOP sección III)
CREATE OR REPLACE VIEW vista_facturacion_servicios AS
SELECT
  gf.fecha,
  s.nombre AS sucursal,
  cl.nombre AS cliente,
  ser.codigo AS servicio_codigo,
  ser.nombre AS servicio_nombre,
  SUM(gd.cantidad) AS cantidad_total,
  ser.precio_vigente AS precio_unitario,
  SUM(gd.importe) AS total_bs
FROM guias_fact gf
LEFT JOIN sucursales s ON gf.sucursal_id = s.id
LEFT JOIN clientes cl ON gf.cliente_id = cl.id
LEFT JOIN guias_detalle gd ON gd.guia_id = gf.id
LEFT JOIN servicios ser ON gd.servicio_id = ser.id
GROUP BY gf.fecha, s.nombre, cl.nombre, ser.codigo, ser.nombre, ser.precio_vigente
ORDER BY gf.fecha, s.nombre;

-- ============================================================
-- SEED DE DATOS DE EJEMPLO (basado en datos reales mayo 2017)
-- ============================================================

-- 1. Empresa
INSERT INTO empresas (id, nombre, rif, telefono, direccion, email)
VALUES ('a0a0a0a0-0000-0000-0000-000000000001', 'VICSON SA', 'J-00000000-0', '0212-0000000', 'Valencia, Carabobo', 'contacto@vicson.com')
ON CONFLICT DO NOTHING;

-- 2. Sucursal principal (VICSON VALENCIA — código "023")
INSERT INTO sucursales (id, empresa_id, nombre, codigo, direccion, rif, telefono, responsable)
VALUES ('b0b0b0b0-0000-0000-0000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001',
        'VICSON VALENCIA', '023', 'Valencia - Carabobo', 'J-00038411-8', '0424-4198920', 'PEDRO OJEDA')
ON CONFLICT DO NOTHING;

-- 3. Categorías de servicio
INSERT INTO categorias_servicio (id, nombre, descripcion) VALUES
  ('c0c0c0c0-0000-0000-0000-000000000001', 'COMEDOR', 'Servicios de alimentación en comedor'),
  ('c0c0c0c0-0000-0000-0000-000000000002', 'CAFE', 'Ventas de térmo café y leche'),
  ('c0c0c0c0-0000-0000-0000-000000000003', 'REFRIGERIO', 'Ventas de refrigerios'),
  ('c0c0c0c0-0000-0000-0000-000000000004', 'ADMIN', 'Gastos administrativos')
ON CONFLICT DO NOTHING;

-- 4. Servicios de comedor (300001-300006)
INSERT INTO servicios (id, codigo, nombre, categoria_id, indicador, grupo, precio_vigente) VALUES
  ('d0d0d0d0-0000-0000-0000-000000000001', '300001', 'SERV. DESAYUNO PREST. COMEDOR', 'c0c0c0c0-0000-0000-0000-000000000001', 'E', 'Alimentación', 11076.80),
  ('d0d0d0d0-0000-0000-0000-000000000002', '300002', 'SERV. DESAYUNO NO PREST. COMEDOR', 'c0c0c0c0-0000-0000-0000-000000000001', 'G', 'Alimentación', 11076.80),
  ('d0d0d0d0-0000-0000-0000-000000000003', '300003', 'SERV. ALMUERZO PREST. COMEDOR', 'c0c0c0c0-0000-0000-0000-000000000001', 'E', 'Alimentación', 11076.80),
  ('d0d0d0d0-0000-0000-0000-000000000004', '300004', 'SERV. ALMUERZO NO PREST. COMEDOR', 'c0c0c0c0-0000-0000-0000-000000000001', 'G', 'Alimentación', 11076.80),
  ('d0d0d0d0-0000-0000-0000-000000000005', '300005', 'SERV. CENA PREST. COMEDOR', 'c0c0c0c0-0000-0000-0000-000000000001', 'E', 'Alimentación', 11076.80),
  ('d0d0d0d0-0000-0000-0000-000000000006', '300006', 'SERV. CENA NO PREST. COMEDOR', 'c0c0c0c0-0000-0000-0000-000000000001', 'G', 'Alimentación', 11076.80),
  ('d0d0d0d0-0000-0000-0000-000000000007', '300007', 'SOBRE CENA', 'c0c0c0c0-0000-0000-0000-000000000001', 'E', 'Alimentación', 11076.80),
  ('d0d0d0d0-0000-0000-0000-000000000008', '300008', 'REFRIGERIOS', 'c0c0c0c0-0000-0000-0000-000000000003', NULL, 'Reembolsables', 0),
  ('d0d0d0d0-0000-0000-0000-000000000009', '300009', 'MERIENDA 1', 'c0c0c0c0-0000-0000-0000-000000000003', NULL, 'Reembolsables', 0),
  ('d0d0d0d0-0000-0000-0000-00000000000a', '30000a', 'MERIENDA 2', 'c0c0c0c0-0000-0000-0000-000000000003', NULL, 'Reembolsables', 0),
  ('d0d0d0d0-0000-0000-0000-00000000000b', '30000b', 'CAFETIN', 'c0c0c0c0-0000-0000-0000-000000000002', NULL, 'Café', 0),
  ('d0d0d0d0-0000-0000-0000-00000000000c', '30000c', 'EFECTIVO', 'c0c0c0c0-0000-0000-0000-000000000001', NULL, 'Alimentación', 0),
  ('d0d0d0d0-0000-0000-0000-00000000000d', '30000d', 'OTROS', 'c0c0c0c0-0000-0000-0000-000000000001', NULL, 'Alimentación', 0)
ON CONFLICT DO NOTHING;

-- 5. Cliente (SELOGRA 111, C.A. — empresa que contrata a VICSON)
INSERT INTO clientes (id, empresa_id, nombre, rif, telefono, contacto_nombre, contacto_cargo, contacto_tel, email, estado)
VALUES ('e0e0e0e0-0000-0000-0000-000000000001', 'a0a0a0a0-0000-0000-0000-000000000001',
        'SELOGRA 111, C.A.', 'J-00000000-0', '0212-0000000',
        'DAMIR DROVINIC', 'RECURSOS HUMANOS', '0424-4198920',
        'contacto@selogra.com', 'activo')
ON CONFLICT DO NOTHING;

-- 6. Contrato (VICSON VALENCIA — contrato CUP con Pedro Ojeda)
INSERT INTO contratos (id, sucursal_id, nombre, responsable, telefono, email, estado)
VALUES ('f0f0f0f0-0000-0000-0000-000000000001', 'b0b0b0b0-0000-0000-0000-000000000001',
        'VICSON VALENCIA', 'PEDRO OJEDA', '0424-4198920', 'pedro.ojeda@vicson.com', 'activo')
ON CONFLICT DO NOTHING;

-- 7. Objetivos CUP para mayo 2017 (almuerzo, ejemplo día 15)
INSERT INTO objetivo_cup (id, contrato_id, servicio_id, anio, mes, fecha, meta, precio)
VALUES
  ('07070707-0000-0000-0000-000000000001', 'f0f0f0f0-0000-0000-0000-000000000001',
   'd0d0d0d0-0000-0000-0000-000000000003', 2017, 5, '2017-05-15', 0.5741151915576841, 1335210.68)
ON CONFLICT DO NOTHING;

-- 8. CUP diario (ejemplo: lunes 15-mayo-2017)
INSERT INTO cup_diario (id, contrato_id, fecha, dia_semana,
    sobrecena, desayuno, almuerzo, cena, refrigerios,
    merienda_1, merienda_2, efectivo, cafetin, otros,
    total_venta, costo_insumos, desechables, costo_cup, costo_personal)
VALUES
  ('08080808-0000-0000-0000-000000000001', 'f0f0f0f0-0000-0000-0000-000000000001',
   '2017-05-15', 'LUNES',
   0, 0, 1335210.68, 0, 0,
   0, 0, 0, 0, 0,
   2536472.80, 1405418.37, 70207.69, 0, 0)
ON CONFLICT DO NOTHING;

-- 9. Venta comensal asociada al CUP anterior
INSERT INTO venta_comensal (id, cup_id, fecha, dia, n_almuerzo, precio_alm, subtotal_alm, n_cena, precio_cena, subtotal_cena, total_general)
VALUES
  ('09090909-0000-0000-0000-000000000001', '08080808-0000-0000-0000-000000000001',
   '2017-05-15', 'L', 191, 11076.80, 2115668.80, 72, 11076.80, 797529.60, 2913198.40)
ON CONFLICT DO NOTHING;

-- 10. Productos de refrigerio (ejemplos del inventario/show)
INSERT INTO productos_refri (id, nombre, codigo, categoria, precio, unidad) VALUES
  ('0a0a0a0a-0000-0000-0000-000000000001', 'JARRA DE JUGO', '1001', 'JUGOS', 20, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000002', 'CACHITO', '1002', 'PASAPALOS', 20, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000003', 'SUBAMARIBNOS GRANJEROS PAN CANILLA', '1003', 'PASAPALOS', 3500, 'KG'),
  ('0a0a0a0a-0000-0000-0000-000000000004', 'SANDWINCH', '1004', 'SANDWICHES', 2000, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000005', 'PASAPALOS/CROASANT', '1005', 'PASAPALOS', 2100, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000006', 'EMPANADA/PASTELITOS', '1006', 'PASAPALOS', 1000, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000007', 'DULCES PEQUEÑOS', '1007', 'DULCES', 1200, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000008', 'TERMO DE LECHE', '1008', 'CAFE', 4100, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000009', 'TERMO DE CAFÉ', '1009', 'CAFE', 4100, 'UND'),
  ('0a0a0a0a-0000-0000-0000-00000000000a', 'SANDWCH ESPECIAL', '1010', 'SANDWICHES', 2520, 'UND'),
  ('0a0a0a0a-0000-0000-0000-00000000000b', 'GATORADE', '1011', 'REFRESCOS', 2520, 'UND'),
  ('0a0a0a0a-0000-0000-0000-00000000000c', 'PASTA SECA', '1012', 'PASAPALOS', 12500, 'UND'),
  ('0a0a0a0a-0000-0000-0000-00000000000d', 'PASAPALOS HOJALDRES', '1013', 'PASAPALOS', 2100, 'UND'),
  ('0a0a0a0a-0000-0000-0000-00000000000e', 'JARRO DE JUGO', '1014', 'JUGOS', 5500, 'UND'),
  ('0a0a0a0a-0000-0000-0000-00000000000f', 'AGUA PEQUENA', '1015', 'REFRESCOS', 840, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000010', 'MESA DE PASAPALOS', '1016', 'PASAPALOS', 1500, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000011', 'MINI PASTELITOS VARIADOS', '1017', 'DULCES', 2000, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000012', 'TARTALETAS, DULICES GRANDES', '1018', 'DULCES', 1500, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000013', 'EREPAS RELLENAS', '1019', 'PASAPALOS', 3100, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000014', 'YOGURT CON CEREAL', '1020', 'DULCES', 1600, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000015', 'ENSALADAS DE FRUTAS', '1021', 'DULCES', 1690, 'UND'),
  ('0a0a0a0a-0000-0000-0000-000000000016', 'TEQUEÑOS (100 UNIDADES)', '1022', 'PASAPALOS', 1690, 'UND')
ON CONFLICT DO NOTHING;

-- 11. Proveedor (ejemplo: PROCESADORA DE CARNES FITCA)
INSERT INTO proveedores (id, nombre, rif, telefono, email, estado)
VALUES ('0b0b0b0b-0000-0000-0000-000000000001', 'PROCESADORA DE CARNES FITCA, C.A.', 'J-00000000-0', '0212-0000000', 'contacto@fitca.com', 'activo')
ON CONFLICT DO NOTHING;

-- 12. CFC ejemplo (factura de carne)
INSERT INTO cfc (id, sucursal_id, cfc_n, fecha_doc, proveedor_id, documento_n, nota_recepcion,
    alimentos, desechables, reembolsables, varios, subtotal, descuentos, monto_iva, total_iva, cuenta_contable)
VALUES
  ('0c0c0c0c-0000-0000-0000-000000000001', 'b0b0b0b0-0000-0000-0000-000000000001',
   1, '2017-05-04', '0b0b0b0b-0000-0000-0000-000000000001',
   '00079211', NULL,
   182099.72, 0, 0, 0, 182099.72, 0, 0, 182099.72, '51102013 - Alimentos')
ON CONFLICT DO NOTHING;

-- 13. Refrigerio diario (ejemplo del 1-ro mayo 2017 — única fila con datos)
INSERT INTO refri_diario (id, cup_id, producto_id, fecha, cantidad, importe)
VALUES
  ('0d0d0d0d-0000-0000-0000-000000000001', '08080808-0000-0000-0000-000000000001',
   '0a0a0a0a-0000-0000-0000-000000000001', '2017-05-01', 20, 400),
  ('0d0d0d0d-0000-0000-0000-000000000002', '08080808-0000-0000-0000-000000000001',
   '0a0a0a0a-0000-0000-0000-000000000002', '2017-05-01', 20, 400)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Activar RLS en todas las tablas
ALTER TABLE empresas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE objetivo_cup       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cup_diario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_comensal     ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_refri    ENABLE ROW LEVEL SECURITY;
ALTER TABLE refri_diario       ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_termo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guias_fact         ENABLE ROW LEVEL SECURITY;
ALTER TABLE guias_detalle      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reembolsables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cfc                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rg                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE px                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_mov     ENABLE ROW LEVEL SECURITY;
ALTER TABLE traspasos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomina_cambios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE establecimientos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dic                ENABLE ROW LEVEL SECURITY;
ALTER TABLE headcount          ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE traspasos_recibidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE traspasos_emitidos ENABLE ROW LEVEL SECURITY;

-- Tabla auxiliar para mapear usuario → sucursal (se pobla desde la app al hacer signup)
-- Esta tabla existe fuera del SQL de arriba; se crea aquí para RLS
CREATE TABLE IF NOT EXISTS user_sucursal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sucursal_id     UUID REFERENCES sucursales(id) ON DELETE CASCADE,
  rol             TEXT NOT NULL CHECK (rol IN ('admin','gerente','operador','pendiente')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_sucursal ENABLE ROW LEVEL SECURITY;

-- Función y trigger para crear user_sucursal cuando un usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_sucursal (user_id, rol, sucursal_id)
  VALUES (new.id, 'pendiente', NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

-- Función helper: obtener el rol y sucursal_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_user_context()
RETURNS TABLE (user_id UUID, sucursal_id UUID, rol TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT us.user_id, us.sucursal_id, us.rol
  FROM user_sucursal us
  WHERE us.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: usuario es admin (oficina central, puede ver todo)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_sucursal
    WHERE user_id = auth.uid() AND rol = 'admin'
  );
$$ LANGUAGE sql STABLE;

-- Función: usuario puede ver la sucursal dada
CREATE OR REPLACE FUNCTION can_view_sucursal(sucursal_id_param UUID)
RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN is_admin() THEN TRUE
      ELSE EXISTS (
        SELECT 1 FROM user_sucursal
        WHERE user_id = auth.uid()
          AND sucursal_id = sucursal_id_param
          AND rol IN ('gerente','operador')
      )
    END;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- POLÍTICAS RLS POR TABLA
-- ============================================================

-- --- EMPRESAS ---
CREATE POLICY "admin_y_gerentes_pueden_ver_empresas"
  ON empresas FOR SELECT
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM user_sucursal WHERE user_id = auth.uid() AND rol IN ('gerente','operador')
  ));

CREATE POLICY "admin_puede_insertar_empresas"
  ON empresas FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "admin_puede_actualizar_empresas"
  ON empresas FOR UPDATE
  USING (is_admin()) WITH CHECK (is_admin());

-- --- SUCURSALES ---
CREATE POLICY "usuarios_pueden_ver_sucursales_asignadas"
  ON sucursales FOR SELECT
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM user_sucursal WHERE user_id = auth.uid()
      AND sucursal_id = sucursales.id AND rol IN ('gerente','operador')
  ));

CREATE POLICY "admin_puede_manage_sucursales"
  ON sucursales FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- --- CONTRATOS ---
CREATE POLICY "usuarios_pueden_ver_contratos_de_sucursal"
  ON contratos FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      JOIN sucursales s ON s.id = us.sucursal_id
      WHERE us.user_id = auth.uid()
        AND s.id = contratos.sucursal_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_contratos"
  ON contratos FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- SERVICIOS y CATEGORIAS (datos maestros, solo admin los maneja pero todos los leen) ---
CREATE POLICY "todos_pueden_ver_servicios"
  ON servicios FOR SELECT
  USING (true);

CREATE POLICY "admin_puede_manage_servicios"
  ON servicios FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "todos_pueden_ver_categorias"
  ON categorias_servicio FOR SELECT
  USING (true);

CREATE POLICY "admin_puede_manage_categorias"
  ON categorias_servicio FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- --- OBJETIVO_CUP ---
CREATE POLICY "usuarios_pueden_ver_objetivos_de_sucursal"
  ON objetivo_cup FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      JOIN sucursales s ON s.id = us.sucursal_id
      JOIN contratos c ON c.sucursal_id = s.id
      WHERE us.user_id = auth.uid()
        AND c.id = objetivo_cup.contrato_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_objetivos"
  ON objetivo_cup FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- CUP_DIARIO ---
CREATE POLICY "usuarios_pueden_ver_cup_de_sucursal"
  ON cup_diario FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      JOIN sucursales s ON s.id = us.sucursal_id
      JOIN contratos c ON c.sucursal_id = s.id
      WHERE us.user_id = auth.uid()
        AND c.id = cup_diario.contrato_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_cup"
  ON cup_diario FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- VENTA_COMENSAL (depende de cup_diario, hereda el filtro) ---
CREATE POLICY "usuarios_pueden_ver_ventas_comensales"
  ON venta_comensal FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cup_diario cd
      JOIN contratos c ON c.id = cd.contrato_id
      JOIN sucursales s ON s.id = c.sucursal_id
      JOIN user_sucursal us ON us.sucursal_id = s.id
      WHERE cd.id = venta_comensal.cup_id
        AND us.user_id = auth.uid()
        AND us.rol IN ('gerente','operador')
    ) OR is_admin()
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_ventas_comensales"
  ON venta_comensal FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- PRODUCTOS_REFri ---
CREATE POLICY "todos_pueden_ver_productos_refri"
  ON productos_refri FOR SELECT
  USING (true);

CREATE POLICY "admin_puede_manage_productos_refri"
  ON productos_refri FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- --- REFRI_DIARIO ---
CREATE POLICY "usuarios_pueden_ver_refris"
  ON refri_diario FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      JOIN sucursales s ON s.id = us.sucursal_id
      JOIN contratos c ON c.sucursal_id = s.id
      JOIN cup_diario cd ON cd.contrato_id = c.id
      WHERE us.user_id = auth.uid()
        AND cd.id = refri_diario.cup_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_refris"
  ON refri_diario FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- VENTA_TERMO ---
CREATE POLICY "usuarios_pueden_ver_termos"
  ON venta_termo FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      JOIN sucursales s ON s.id = us.sucursal_id
      JOIN contratos c ON c.sucursal_id = s.id
      JOIN cup_diario cd ON cd.contrato_id = c.id
      WHERE us.user_id = auth.uid()
        AND cd.id = venta_termo.cup_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_termos"
  ON venta_termo FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- CLIENTES ---
CREATE POLICY "todos_pueden_ver_clientes"
  ON clientes FOR SELECT
  USING (true);

CREATE POLICY "admin_y_gerentes_pueden_manage_clientes"
  ON clientes FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- GUIAS_FACT ---
CREATE POLICY "usuarios_pueden_ver_guias_de_sucursal"
  ON guias_fact FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      WHERE us.user_id = auth.uid()
        AND us.sucursal_id = guias_fact.sucursal_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_guias"
  ON guias_fact FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- GUIAS_DETALLE ---
CREATE POLICY "usuarios_pueden_ver_detalles_de_guias"
  ON guias_detalle FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guias_fact gf
      JOIN user_sucursal us ON us.sucursal_id = gf.sucursal_id
      WHERE gf.id = guias_detalle.guia_id
        AND us.user_id = auth.uid()
        AND us.rol IN ('gerente','operador')
    ) OR is_admin()
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_detalles"
  ON guias_detalle FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- PROVEEDORES ---
CREATE POLICY "todos_pueden_ver_proveedores"
  ON proveedores FOR SELECT
  USING (true);

CREATE POLICY "admin_y_gerentes_pueden_manage_proveedores"
  ON proveedores FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- REEMBOLSABLES ---
CREATE POLICY "usuarios_pueden_ver_reembolsables_de_sucursal"
  ON reembolsables FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      WHERE us.user_id = auth.uid()
        AND us.sucursal_id = reembolsables.sucursal_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_reembolsables"
  ON reembolsables FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- CFC ---
CREATE POLICY "usuarios_pueden_ver_cfc_de_sucursal"
  ON cfc FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      WHERE us.user_id = auth.uid()
        AND us.sucursal_id = cfc.sucursal_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_cfc"
  ON cfc FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- RG ---
CREATE POLICY "usuarios_pueden_ver_rg_de_sucursal"
  ON rg FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      WHERE us.user_id = auth.uid()
        AND us.sucursal_id = rg.sucursal_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_rg"
  ON rg FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- PX ---
CREATE POLICY "usuarios_pueden_ver_px_de_sucursal"
  ON px FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      WHERE us.user_id = auth.uid()
        AND us.sucursal_id = px.sucursal_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_px"
  ON px FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- INVENTARIO ---
CREATE POLICY "usuarios_pueden_ver_inventario_de_sucursal"
  ON inventario FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      WHERE us.user_id = auth.uid()
        AND us.sucursal_id = inventario.sucursal_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_inventario"
  ON inventario FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- INVENTARIO_MOV ---
CREATE POLICY "usuarios_pueden_ver_mov_de_inventario"
  ON inventario_mov FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inventario i
      JOIN user_sucursal us ON us.sucursal_id = i.sucursal_id
      WHERE i.id = inventario_mov.inventario_id
        AND us.user_id = auth.uid()
        AND us.rol IN ('gerente','operador')
    ) OR is_admin()
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_mov_inventario"
  ON inventario_mov FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- TRASPASOS ---
CREATE POLICY "usuarios_pueden_ver_traspasos_de_sucursal"
  ON traspasos FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      WHERE us.user_id = auth.uid()
        AND (us.sucursal_id = traspasos.sucursal_origen
             OR us.sucursal_id = traspasos.sucursal_destino)
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_traspasos"
  ON traspasos FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- NOMINA_CAMBIOS ---
CREATE POLICY "usuarios_pueden_ver_nomina_de_sucursal"
  ON nomina_cambios FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      JOIN sucursales s ON s.id = us.sucursal_id
      JOIN contratos c ON c.sucursal_id = s.id
      WHERE us.user_id = auth.uid()
        AND c.id = nomina_cambios.contrato_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_nomina"
  ON nomina_cambios FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- ESTABLECIMIENTOS ---
CREATE POLICY "todos_pueden_ver_establecimientos"
  ON establecimientos FOR SELECT
  USING (true);

CREATE POLICY "admin_puede_manage_establecimientos"
  ON establecimientos FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- --- DIC ---
CREATE POLICY "usuarios_pueden_ver_dic_de_sucursal"
  ON dic FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      WHERE us.user_id = auth.uid()
        AND us.sucursal_id = dic.sucursal_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_dic"
  ON dic FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- HEADCOUNT ---
CREATE POLICY "usuarios_pueden_ver_headcount"
  ON headcount FOR SELECT
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal us
      JOIN sucursales s ON s.id = us.sucursal_id
      JOIN contratos c ON c.sucursal_id = s.id
      WHERE us.user_id = auth.uid()
        AND c.id = headcount.contrato_id
        AND us.rol IN ('gerente','operador')
    )
  );

CREATE POLICY "admin_y_gerentes_pueden_manage_headcount"
  ON headcount FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- FACTURACION_CLIENTE y FACTURACION_SERVICIO (dependen de dic) ---
CREATE POLICY "usuarios_pueden_ver_fact_clientes"
  ON facturacion_cliente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dic d
      JOIN user_sucursal us ON us.sucursal_id = d.sucursal_id
      WHERE d.id = facturacion_cliente.dic_id
        AND us.user_id = auth.uid()
        AND us.rol IN ('gerente','operador')
    ) OR is_admin()
  );

CREATE POLICY "admin_y_gerentes_fact_clientes"
  ON facturacion_cliente FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

CREATE POLICY "usuarios_pueden_ver_fact_servicios"
  ON facturacion_servicio FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dic d
      JOIN user_sucursal us ON us.sucursal_id = d.sucursal_id
      WHERE d.id = facturacion_servicio.dic_id
        AND us.user_id = auth.uid()
        AND us.rol IN ('gerente','operador')
    ) OR is_admin()
  );

CREATE POLICY "admin_y_gerentes_fact_servicios"
  ON facturacion_servicio FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- --- TRASPASOS_RECIBIDOS y TRASPASOS_EMITIDOS ---
CREATE POLICY "usuarios_pueden_ver_tr_recibidos"
  ON traspasos_recibidos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dic d
      JOIN user_sucursal us ON us.sucursal_id = d.sucursal_id
      WHERE d.id = traspasos_recibidos.dic_id
        AND us.user_id = auth.uid()
        AND us.rol IN ('gerente','operador')
    ) OR is_admin()
  );

CREATE POLICY "admin_y_gerentes_tr_recibidos"
  ON traspasos_recibidos FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

CREATE POLICY "usuarios_pueden_ver_tr_emitidos"
  ON traspasos_emitidos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dic d
      JOIN user_sucursal us ON us.sucursal_id = d.sucursal_id
      WHERE d.id = traspasos_emitidos.dic_id
        AND us.user_id = auth.uid()
        AND us.rol IN ('gerente','operador')
    ) OR is_admin()
  );

CREATE POLICY "admin_y_gerentes_tr_emitidos"
  ON traspasos_emitidos FOR ALL
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM user_sucursal
      WHERE user_id = auth.uid() AND rol IN ('admin','gerente')
    )
  );

-- ============================================================
-- NOTAS FINALES
-- ============================================================
-- 1. Tabla user_sucursal se popula desde la aplicación al crear/editar usuarios.
--    Por defecto, un usuario sin registro en user_sucursal NO verá ningún dato.
-- 2. El campo "CONTROL DE TRASPASOS VICSON VALENCIA CORTE AL 19 DE MAYO.xls"
--    sigue encriptado. La tabla traspasos está lista para recibir estos datos cuando
--    se tenga la contraseña.
-- 3. Las vistas vista_ventas_diarias, vista_resumen_mensual, vista_dic_resumen,
--    vista_resumen_cfc y vista_facturacion_servicios son los principales dashboards.
-- 4. Los triggers update_updated_at mantienen la columna updated_at sincronizada.
-- 5. Para insertar el resto de los datos reales (todos los días de mayo 2017,
--    todas las guías, todas las facturas CFC), ejecutar el script ETL Python
--    que leerá los archivos Excel y hará INSERT/UPSERT en las tablas.
