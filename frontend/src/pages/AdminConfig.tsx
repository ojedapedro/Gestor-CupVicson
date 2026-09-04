import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

import { DataTable } from '../components/DataTable';
import { FormField, SelectField, Button } from '../components/FormField';
import {
  Building2,
  Users,
  FileText,
  Package,
  Contact,
  Tag,
  Plus,
  Edit3,
  Trash2,
  X,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

type TabId = 'empresas' | 'sucursales' | 'contratos' | 'servicios' | 'clientes' | 'productos' | 'proveedores' | 'usuarios';

type Column = {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render?: (value: any, row: any) => React.ReactNode;
};

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'empresas', label: 'Empresas', icon: Building2 },
  { id: 'sucursales', label: 'Sucursales', icon: Building2 },
  { id: 'contratos', label: 'Contratos CUP', icon: FileText },
  { id: 'servicios', label: 'Servicios', icon: Tag },
  { id: 'clientes', label: 'Clientes', icon: Contact },
  { id: 'productos', label: 'Productos Refri', icon: Package },
  { id: 'proveedores', label: 'Proveedores', icon: Tag },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
];

export function AdminConfig() {
  const [activeTab, setActiveTab] = useState<TabId>('empresas');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any[]>>({});
  const [cargandoForm, setCargandoForm] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Data loaders
  const loadData = async (tab: TabId) => {
    try {
      const queries: Record<TabId, any> = {
        empresas: supabase.from('empresas').select('*').order('nombre'),
        sucursales: supabase.from('sucursales').select('*, empresas(nombre)').order('nombre'),
        contratos: supabase.from('contratos').select('*, sucursales(nombre, codigo)').order('nombre'),
        servicios: supabase.from('servicios').select('*, categorias_servicio(nombre)').order('codigo'),
        clientes: supabase.from('clientes').select('*').order('nombre'),
        productos: supabase.from('productos_refri').select('*').order('nombre'),
        proveedores: supabase.from('proveedores').select('*').order('nombre'),
        usuarios: supabase.from('user_sucursal').select('*, auth.users(email)').order('created_at', { ascending: false }),
      };
      const { data: d, error: err } = await queries[tab];
      if (err) throw err;
      setData((prev: Record<string, any[]>) => ({ ...prev, [tab]: d ?? [] }));
    } catch (e) {
      console.error(e);
      setData((prev: Record<string, any[]>) => ({ ...prev, [tab]: [] }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData(activeTab);
  }, [activeTab]);

  // Form handlers genéricos
  const resetForm = () => {
    setForm({});
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const openForm = (item?: any) => {
    if (item) {
      setForm(item);
      setEditingId(item.id);
    } else {
      setForm({ estado: 'activo' });
      setEditingId(null);
    }
    setShowForm(true);
  };

  const handleChange = (key: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const tableName = getTableName(activeTab);
      const data: any = { ...form };
      // Convertir campos especiales
      if (data.estado === 'activo') data.estado = 'activo';
      if (data.precio_unit !== undefined && data.precio_unit !== '') data.precio_unit = Number(data.precio_unit);
      if (data.precio !== undefined && data.precio !== '') data.precio = Number(data.precio);
      if (data.stock_minimo !== undefined && data.stock_minimo !== '') data.stock_minimo = Number(data.stock_minimo);

      let result;
      if (editingId) {
        result = await supabase.from(tableName).update(data).eq('id', editingId).select().single();
      } else {
        result = await supabase.from(tableName).insert(data).select().single();
      }
      if (result.error) throw result.error;
      await loadData(activeTab);
      resetForm();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
    const tableName = getTableName(activeTab);
    const { error: err } = await supabase.from(tableName).delete().eq('id', id);
    if (err) {
      alert('Error: ' + err.message);
    } else {
      await loadData(activeTab);
    }
  };

  const getTableName = (tab: TabId): string => {
    const map: Record<TabId, string> = {
      empresas: 'empresas',
      sucursales: 'sucursales',
      contratos: 'contratos',
      servicios: 'servicios',
      clientes: 'clientes',
      productos: 'productos_refri',
      proveedores: 'proveedores',
      usuarios: 'user_sucursal',
    };
    return map[tab];
  };

  const getColumns = (tab: TabId): Column[] => {
    const commonAcciones: Column[] = [
      {
        key: '',
        header: 'Acciones',
        align: 'center',
        render: (_: any, row: any) => (
          <div className="flex items-center justify-end gap-1">
            <button onClick={(e) => { e.stopPropagation(); openForm(row); }} className="p-1.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
              <Edit3 size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ),
      },
    ];

    switch (tab) {
      case 'empresas':
        return [
          { key: 'nombre', header: 'Empresa', render: (v: any) => <span className="font-medium text-slate-800">{v ?? '-'}</span> },
          { key: 'rif', header: 'RIF', render: (v: any) => <span className="text-sm text-slate-500">{v ?? '-'}</span> },
          { key: 'telefono', header: 'Teléfono', render: (v: any) => <span className="text-sm text-slate-500">{v ?? '-'}</span> },
          { key: 'estado', header: 'Estado', render: (v: any) => <span className={`text-xs px-2 py-0.5 rounded-full ${v === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{v}</span> },
          ...commonAcciones,
        ];
      case 'sucursales':
        return [
          { key: 'nombre', header: 'Sucursal', render: (v: any) => <span className="font-medium">{v ?? '-'}</span> },
          { key: 'codigo', header: 'Código', render: (v: any) => <span className="font-mono text-sm text-slate-600">{v ?? '-'}</span> },
          { key: 'empresas', header: 'Empresa', render: (_: any, row: any) => <span className="text-sm text-slate-600">{row.empresas?.nombre ?? '-'}</span> },
          { key: 'responsable', header: 'Responsable', render: (v: any) => <span className="text-sm text-slate-600">{v ?? '-'}</span> },
          { key: 'estado', header: 'Estado', render: (v: any) => <span className={`text-xs px-2 py-0.5 rounded-full ${v === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{v}</span> },
          ...commonAcciones,
        ];
      case 'contratos':
        return [
          { key: 'nombre', header: 'Contrato', render: (v: any) => <span className="font-medium">{v ?? '-'}</span> },
          { key: 'sucursales', header: 'Sucursal', render: (_: any, row: any) => (
            <div>
              <div className="text-sm text-slate-700">{row.sucursales?.nombre ?? '-'}</div>
              <div className="text-xs text-slate-400">{row.sucursales?.codigo ?? ''}</div>
            </div>
          )},
          { key: 'responsable', header: 'Responsable', render: (v: any) => <span className="text-sm text-slate-600">{v ?? '-'}</span> },
          { key: 'estado', header: 'Estado', render: (v: any) => <span className={`text-xs px-2 py-0.5 rounded-full ${v === 'activo' ? 'bg-emerald-100 text-emerald-700' : v === 'vencido' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{v}</span> },
          ...commonAcciones,
        ];
      case 'servicios':
        return [
          { key: 'codigo', header: 'Código', render: (v: any) => <span className="font-mono font-medium">{v ?? '-'}</span> },
          { key: 'nombre', header: 'Servicio', render: (v: any) => <span className="text-sm text-slate-700">{v ?? '-'}</span> },
          { key: 'categorias_servicio', header: 'Categoría', render: (_: any, row: any) => <span className="text-xs text-slate-500">{row.categorias_servicio?.nombre ?? '-'}</span> },
          { key: 'indicador', header: 'Ind.', render: (v: any) => <span className="text-xs font-mono text-slate-500">{v ?? '-'}</span> },
          { key: 'precio_vigente', header: 'Precio', align: 'right', render: (v: any) => <span className="text-sm text-slate-700">{v ? 'Bs. ' + Number(v).toLocaleString() : '-'}</span> },
          ...commonAcciones,
        ];
      case 'clientes':
        return [
          { key: 'nombre', header: 'Cliente', render: (v: any) => <span className="font-medium">{v ?? '-'}</span> },
          { key: 'rif', header: 'RIF', render: (v: any) => <span className="text-sm text-slate-500">{v ?? '-'}</span> },
          { key: 'contacto_nombre', header: 'Contacto', render: (v: any) => <span className="text-sm text-slate-600">{v ?? '-'}</span> },
          { key: 'contacto_cargo', header: 'Cargo', render: (v: any) => <span className="text-xs text-slate-400">{v ?? '-'}</span> },
          { key: 'estado', header: 'Estado', render: (v: any) => <span className={`text-xs px-2 py-0.5 rounded-full ${v === 'activo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{v}</span> },
          ...commonAcciones,
        ];
      case 'productos':
        return [
          { key: 'nombre', header: 'Producto', render: (v: any) => <span className="font-medium">{v ?? '-'}</span> },
          { key: 'codigo', header: 'Código', render: (v: any) => <span className="font-mono text-sm text-slate-600">{v ?? '-'}</span> },
          { key: 'categoria', header: 'Categoría', render: (v: any) => <span className="text-xs text-slate-500">{v ?? '-'}</span> },
          { key: 'precio', header: 'Precio', align: 'right', render: (v: any) => <span className="text-sm text-slate-700">{v ? 'Bs. ' + Number(v).toLocaleString() : '-'}</span> },
          { key: 'unidad', header: 'Unidad', render: (v: any) => <span className="text-xs text-slate-500">{v ?? '-'}</span> },
          ...commonAcciones,
        ];
      case 'proveedores':
        return [
          { key: 'nombre', header: 'Proveedor', render: (v: any) => <span className="font-medium">{v ?? '-'}</span> },
          { key: 'rif', header: 'RIF', render: (v: any) => <span className="text-sm text-slate-500">{v ?? '-'}</span> },
          { key: 'telefono', header: 'Teléfono', render: (v: any) => <span className="text-sm text-slate-600">{v ?? '-'}</span> },
          { key: 'email', header: 'Email', render: (v: any) => <span className="text-xs text-slate-400">{v ?? '-'}</span> },
          ...commonAcciones,
        ];
      case 'usuarios':
        return [
          { key: 'auth.users', header: 'Usuario', render: (_: any, row: any) => (
            <div>
              <div className="font-medium text-slate-800 text-sm">{row['auth.users']?.email ?? '-'}</div>
              <div className="text-xs text-slate-400">ID: {row.user_id?.slice(0, 8)}...</div>
            </div>
          )},
          { key: 'sucursal_id', header: 'Sucursal', render: (v: any) => <span className="text-sm text-slate-600">{v ?? '-'}</span> },
          { key: 'rol', header: 'Rol', render: (v: any) => (
            <span className={`text-xs px-2 py-0.5 rounded-full ${v === 'admin' ? 'bg-red-100 text-red-700' : v === 'gerente' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
              {v}
            </span>
          )},
          { key: 'created_at', header: 'Desde', render: (v: any) => v ? format(new Date(v), 'dd/MM/yyyy') : '-' },
          ...commonAcciones,
        ];
      default:
        return [];
    }
  };

  const getFormFields = (tab: TabId) => {
    switch (tab) {
      case 'empresas':
        return (
          <>
            <FormField label="Nombre *" name="nombre" type="text" value={form.nombre ?? ''} onChange={v => handleChange('nombre', v)} required />
            <FormField label="RIF" name="rif" type="text" value={form.rif ?? ''} onChange={v => handleChange('rif', v)} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Teléfono" name="telefono" type="text" value={form.telefono ?? ''} onChange={v => handleChange('telefono', v)} />
              <FormField label="Email" name="email" type="email" value={form.email ?? ''} onChange={v => handleChange('email', v)} />
            </div>
            <FormField label="Dirección" name="direccion" type="text" value={form.direccion ?? ''} onChange={v => handleChange('direccion', v)} />
            <SelectField label="Estado" name="estado" options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
            ]} value={form.estado ?? 'activo'} onChange={v => handleChange('estado', v)} />
          </>
        );
      case 'sucursales':
        return (
          <>
            <FormField label="Nombre *" name="nombre" type="text" value={form.nombre ?? ''} onChange={v => handleChange('nombre', v)} required />
            <FormField label="Código *" name="codigo" type="text" value={form.codigo ?? ''} onChange={v => handleChange('codigo', v)} required placeholder="ej: 023" />
            <FormField label="Dirección" name="direccion" type="text" value={form.direccion ?? ''} onChange={v => handleChange('direccion', v)} />
            <FormField label="RIF" name="rif" type="text" value={form.rif ?? ''} onChange={v => handleChange('rif', v)} />
            <FormField label="Teléfono" name="telefono" type="text" value={form.telefono ?? ''} onChange={v => handleChange('telefono', v)} />
            <FormField label="Responsable" name="responsable" type="text" value={form.responsable ?? ''} onChange={v => handleChange('responsable', v)} />
            <SelectField label="Estado" name="estado" options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
            ]} value={form.estado ?? 'activo'} onChange={v => handleChange('estado', v)} />
          </>
        );
      case 'contratos':
        return (
          <>
            <FormField label="Nombre *" name="nombre" type="text" value={form.nombre ?? ''} onChange={v => handleChange('nombre', v)} required />
            <FormField label="Responsable" name="responsable" type="text" value={form.responsable ?? ''} onChange={v => handleChange('responsable', v)} />
            <FormField label="Teléfono" name="telefono" type="text" value={form.telefono ?? ''} onChange={v => handleChange('telefono', v)} />
            <FormField label="Email" name="email" type="email" value={form.email ?? ''} onChange={v => handleChange('email', v)} />
            <SelectField label="Estado" name="estado" options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
              { value: 'vencido', label: 'Vencido' },
            ]} value={form.estado ?? 'activo'} onChange={v => handleChange('estado', v)} />
          </>
        );
      case 'servicios':
        return (
          <>
            <FormField label="Código *" name="codigo" type="text" value={form.codigo ?? ''} onChange={v => handleChange('codigo', v)} required placeholder="ej: 300001" />
            <FormField label="Nombre *" name="nombre" type="text" value={form.nombre ?? ''} onChange={v => handleChange('nombre', v)} required />
            <FormField label="Descripción" name="descripcion" type="text" value={form.descripcion ?? ''} onChange={v => handleChange('descripcion', v)} />
            <FormField label="Precio Vigente (Bs.)" name="precio_vigente" type="number" value={form.precio_vigente ?? ''} onChange={v => handleChange('precio_vigente', v)} step={0.01} />
            <SelectField label="Ind." name="indicador" options={[
              { value: 'E', label: 'E — Prestado con comedor' },
              { value: 'G', label: 'G — No prestado sin comedor' },
              { value: '', label: 'Sin indicador' },
            ]} value={form.indicador ?? ''} onChange={v => handleChange('indicador', v)} />
            <SelectField label="Estado" name="estado" options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
            ]} value={form.estado ?? 'activo'} onChange={v => handleChange('estado', v)} />
          </>
        );
      case 'clientes':
        return (
          <>
            <FormField label="Nombre *" name="nombre" type="text" value={form.nombre ?? ''} onChange={v => handleChange('nombre', v)} required />
            <FormField label="RIF" name="rif" type="text" value={form.rif ?? ''} onChange={v => handleChange('rif', v)} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Teléfono" name="telefono" type="text" value={form.telefono ?? ''} onChange={v => handleChange('telefono', v)} />
              <FormField label="Email" name="email" type="email" value={form.email ?? ''} onChange={v => handleChange('email', v)} />
            </div>
            <FormField label="Contacto Nombre" name="contacto_nombre" type="text" value={form.contacto_nombre ?? ''} onChange={v => handleChange('contacto_nombre', v)} />
            <FormField label="Contacto Cargo" name="contacto_cargo" type="text" value={form.contacto_cargo ?? ''} onChange={v => handleChange('contacto_cargo', v)} />
            <FormField label="Contacto Teléfono" name="contacto_tel" type="text" value={form.contacto_tel ?? ''} onChange={v => handleChange('contacto_tel', v)} />
            <FormField label="Dirección" name="direccion" type="text" value={form.direccion ?? ''} onChange={v => handleChange('direccion', v)} />
            <SelectField label="Estado" name="estado" options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
            ]} value={form.estado ?? 'activo'} onChange={v => handleChange('estado', v)} />
          </>
        );
      case 'productos':
        return (
          <>
            <FormField label="Nombre *" name="nombre" type="text" value={form.nombre ?? ''} onChange={v => handleChange('nombre', v)} required />
            <FormField label="Código" name="codigo" type="text" value={form.codigo ?? ''} onChange={v => handleChange('codigo', v)} />
            <FormField label="Categoría" name="categoria" type="text" value={form.categoria ?? ''} onChange={v => handleChange('categoria', v)} placeholder="ej: JUGOS, SANDWICHES" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Precio (Bs.)" name="precio" type="number" value={form.precio ?? ''} onChange={v => handleChange('precio', v)} step={0.01} />
              <FormField label="Unidad" name="unidad" type="text" value={form.unidad ?? ''} onChange={v => handleChange('unidad', v)} placeholder="KG, UND, L" />
            </div>
            <FormField label="Stock Mínimo" name="stock_minimo" type="number" value={form.stock_minimo ?? ''} onChange={v => handleChange('stock_minimo', v)} step={0.01} min={0} />
            <SelectField label="Estado" name="estado" options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
            ]} value={form.estado ?? 'activo'} onChange={v => handleChange('estado', v)} />
          </>
        );
      case 'proveedores':
        return (
          <>
            <FormField label="Nombre *" name="nombre" type="text" value={form.nombre ?? ''} onChange={v => handleChange('nombre', v)} required />
            <FormField label="RIF" name="rif" type="text" value={form.rif ?? ''} onChange={v => handleChange('rif', v)} />
            <FormField label="Teléfono" name="telefono" type="text" value={form.telefono ?? ''} onChange={v => handleChange('telefono', v)} />
            <FormField label="Email" name="email" type="email" value={form.email ?? ''} onChange={v => handleChange('email', v)} />
            <FormField label="Dirección" name="direccion" type="text" value={form.direccion ?? ''} onChange={v => handleChange('direccion', v)} />
            <SelectField label="Estado" name="estado" options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
            ]} value={form.estado ?? 'activo'} onChange={v => handleChange('estado', v)} />
          </>
        );
      case 'usuarios':
        return (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Para gestionar usuarios, usa la consola de Supabase directamente:
            la tabla <code>user_sucursal</code> mapea usuarios → sucursal + rol.
          </div>
        );
      default:
        return <div className="text-sm text-slate-400">Formulario no disponible</div>;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="text-sm text-slate-500 mt-0.5">Mantenimiento de datos maestros</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setLoading(true); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-brand-600 text-brand-700 -mb-px'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Data table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm animate-pulse bg-white rounded-lg border border-slate-200">
          Cargando...
        </div>
      ) : (
        <>
          {data[activeTab]?.length === 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-slate-600 font-medium">Sin registros en "{tabs.find(t => t.id === activeTab)?.label}"</p>
              <p className="text-sm text-slate-400 mt-1">Presioná "+ Nuevo" para agregar el primero.</p>
            </div>
          )}
          {data[activeTab] && data[activeTab].length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <DataTable
                data={data[activeTab]}
                columns={getColumns(activeTab)}
                loading={false}
                emptyMessage="Sin datos"
              />
            </div>
          )}
        </>
      )}

      {/* Nuevo button */}
      <div className="flex justify-end">
        <Button onClick={() => openForm()} variant="primary" className="mt-2">
          <Plus size={16} />
          Nuevo {tabs.find(t => t.id === activeTab)?.label}
        </Button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingId ? `Editar ${tabs.find(t => t.id === activeTab)?.label}` : `Nuevo ${tabs.find(t => t.id === activeTab)?.label}`}
              </h2>
              <button onClick={resetForm} className="p-1 rounded text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {getFormFields(activeTab)}
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
                <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>Cancelar</Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {editingId ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
