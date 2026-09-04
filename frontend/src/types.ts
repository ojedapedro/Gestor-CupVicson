
// ---------- Tipos base de Supabase ----------

export interface DbRow {
  id: string;
  [key: string]: unknown;
}

// ---------- Empresa ----------

export interface Empresa extends DbRow {
  nombre: string;
  rif: string | null;
  telefono: string | null;
  direccion: string | null;
  email: string | null;
  estado: 'activo' | 'inactivo';
  created_at: string;
}

// ---------- Sucursal ----------

export interface Sucursal extends DbRow {
  empresa_id: string;
  nombre: string;
  codigo: string;
  direccion: string | null;
  rif: string | null;
  telefono: string | null;
  responsable: string | null;
  estado: 'activo' | 'inactivo';
  created_at: string;
}

// ---------- Contrato ----------

export interface Contrato extends DbRow {
  sucursal_id: string;
  nombre: string;
  responsable: string | null;
  telefono: string | null;
  email: string | null;
  estado: 'activo' | 'inactivo' | 'vencido';
  created_at: string;
}

// ---------- Catálogo ----------

export interface CategoriaServicio extends DbRow {
  nombre: string;
  descripcion: string | null;
}

export interface Servicio extends DbRow {
  codigo: string;
  nombre: string;
  categoria_id: string | null;
  indicador: 'E' | 'G' | null;
  grupo: string | null;
  precio_vigente: number | null;
  descripcion: string | null;
}

export interface ProductoRefri extends DbRow {
  nombre: string;
  codigo: string | null;
  categoria: string | null;
  precio: number | null;
  unidad: string | null;
  stock_minimo: number | null;
  estado: 'activo' | 'inactivo';
}

// ---------- CUP ----------

export interface ObjetivoCup extends DbRow {
  contrato_id: string;
  servicio_id: string;
  anio: number;
  mes: number;
  fecha: string | null;
  meta: number | null;
  precio: number | null;
}

export interface CupDiario extends DbRow {
  contrato_id: string;
  fecha: string;
  dia_semana: string | null;
  sobrecena: number | null;
  desayuno: number | null;
  almuerzo: number | null;
  cena: number | null;
  refrigerios: number | null;
  merienda_1: number | null;
  merienda_2: number | null;
  efectivo: number | null;
  cafetin: number | null;
  otros: number | null;
  total_venta: number | null;
  costo_insumos: number | null;
  desechables: number | null;
  costo_cup: number | null;
  costo_personal: number | null;
  created_at: string;
}

export interface VentaComensal extends DbRow {
  cup_id: string;
  fecha: string;
  dia: string | null;
  n_almuerzo: number | null;
  precio_alm: number | null;
  subtotal_alm: number | null;
  n_cena: number | null;
  precio_cena: number | null;
  subtotal_cena: number | null;
  total_general: number | null;
}

export interface RefriDiario extends DbRow {
  cup_id: string;
  producto_id: string;
  fecha: string;
  cantidad: number | null;
  importe: number | null;
}

export interface VentaTermo extends DbRow {
  cup_id: string;
  fecha: string;
  tipo: 'TERMO_CAFE' | 'TERMO_LECHE';
  cantidad: number | null;
  precio: number | null;
  total: number | null;
}

// ---------- Facturación ----------

export interface Cliente extends DbRow {
  empresa_id: string | null;
  nombre: string;
  rif: string | null;
  telefono: string | null;
  email: string | null;
  contacto_nombre: string | null;
  contacto_cargo: string | null;
  contacto_tel: string | null;
  direccion: string | null;
  estado: 'activo' | 'inactivo';
  created_at: string;
}

export interface GuiaFact extends DbRow {
  sucursal_id: string;
  cliente_id: string;
  numero_guia: string;
  fecha: string;
  periodo_ini: string | null;
  periodo_fin: string | null;
  no_oc: string | null;
  factura_n: string | null;
  estado: 'pendiente' | 'facturada' | 'pagada' | 'anulada';
  created_at: string;
}

export interface GuiaDetalle extends DbRow {
  guia_id: string;
  servicio_id: string;
  cantidad: number;
  precio_unit: number;
  importe: number;
  orden: number;
}

// ---------- Compras/Gastos ----------

export interface Proveedor extends DbRow {
  nombre: string;
  rif: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  estado: 'activo' | 'inactivo';
}

export interface Reembolsable extends DbRow {
  sucursal_id: string;
  proveedor_id: string;
  fecha: string;
  ceco: string | null;
  cuenta_contable: string | null;
  factura_n: string | null;
  detalle: string | null;
  costo_total: number;
  iva: number | null;
  total_iva: number | null;
  categoria: string | null;
  created_at: string;
}

export interface Cfc extends DbRow {
  sucursal_id: string;
  cfc_n: number;
  fecha_doc: string;
  proveedor_id: string;
  documento_n: string;
  nota_recepcion: string | null;
  alimentos: number | null;
  desechables: number | null;
  reembolsables: number | null;
  varios: number | null;
  subtotal: number | null;
  descuentos: number | null;
  monto_iva: number | null;
  total_iva: number | null;
  cuenta_contable: string | null;
  created_at: string;
}

export interface Rh extends DbRow {
  sucursal_id: string;
  rg_n: number;
  fecha_doc: string;
  proveedor_id: string;
  documento_n: string | null;
  alimentos: number | null;
  desechables: number | null;
  reembolsables: number | null;
  varios: number | null;
  subtotal: number | null;
  descuentos: number | null;
  monto_iva: number | null;
  total_iva: number | null;
  cuenta_contable: string | null;
  created_at: string;
}

// ---------- Inventario ----------

export interface Inventario extends DbRow {
  sucursal_id: string;
  nombre: string;
  codigo: string | null;
  categoria: string | null;
  subcategoria: string | null;
  unidad: string | null;
  costo_unit: number;
  created_at: string;
}

export interface InventarioMov extends DbRow {
  inventario_id: string;
  tipo_mov: 'entrada' | 'salida' | 'ajuste' | 'inicial' | 'cierre';
  fecha: string;
  cantidad: number;
  usuario_id: string | null;
  observacion: string | null;
  created_at: string;
}

// ---------- Traspasos ----------

export interface Traspaso extends DbRow {
  sucursal_origen: string;
  sucursal_destino: string;
  fecha: string;
  monto: number;
  motivo: string | null;
  estado: 'pendiente' | 'aprobado' | 'anulado';
  created_at: string;
}

// ---------- RECOP / Cierre ----------

export interface Dic extends DbRow {
  sucursal_id: string;
  periodo: string;
  responsable: string | null;
  meta_ventas: number | null;
  resultado: number | null;
  ventas_bs: number | null;
  costo_insumos: number | null;
  costo_personal: number | null;
  desechables: number | null;
  costo_cup_pct: number | null;
  facturacion: number | null;
  ventas_efectivo: number | null;
  total_cfc: number | null;
  total_rg: number | null;
  total_px: number | null;
  total_trasp: number | null;
  inventario_ini: number | null;
  inventario_final: number | null;
  ajustes: number | null;
  created_at: string;
}

export interface Headcount extends DbRow {
  contrato_id: string;
  fecha_cierre: string;
  total_activo: number;
  total_no_activo: number;
  observacion: string | null;
  created_at: string;
}

export interface FacturacionCliente extends DbRow {
  dic_id: string;
  cliente_id: string;
  servicio: string | null;
  numero_guia: string | null;
  numero_factura: string | null;
  monto_facturado: number | null;
  ventas_efectivo: number | null;
}

export interface FacturacionServicio extends DbRow {
  dic_id: string;
  servicio: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  total_bs: number | null;
}

export interface TraspasoRecibido extends DbRow {
  dic_id: string;
  establecimiento_id: string;
  alimentos: number | null;
  desechables: number | null;
  servicios: number | null;
}

export interface TraspasoEmitido extends DbRow {
  dic_id: string;
  establecimiento_id: string;
  alimentos: number | null;
  desechables: number | null;
  servicios: number | null;
}

export interface NominaCambio extends DbRow {
  contrato_id: string;
  fecha: string;
  tipo: 'quincena_1' | 'quincena_2' | 'otros';
  monto: number;
  observacion: string | null;
  created_at: string;
}

// ---------- User ----------

export interface UserSucursal extends DbRow {
  user_id: string;
  sucursal_id: string | null;
  rol: 'admin' | 'gerente' | 'operador' | 'pendiente';
  created_at: string;
}

// ---------- Dashboard ----------

export interface DashboardStats {
  total_ventas_mes: number;
  total_costos: number;
  margen_neto: number;
  porcentaje_costo_sobre_venta: number;
  promedio_venta_dia: number;
  dias_reportados: number;
  total_comensales: number;
  total_iva_recaudado: number;
}

// ---------- Estado global ----------

export interface GlobalFilters {
  mes: string;       // "2017-05"
  sucursal_id: string | null;
  contrato_id: string | null;
}
