import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { formatCurrency } from '../lib/api';
import { Reembolsable, Proveedor } from '../types';
import { DataTable } from '../components/DataTable';
import { FormField, SelectField, Button } from '../components/FormField';
import { StatCard } from '../components/StatCard';
import { ErrorAlert } from '../components/ErrorAlert';
import { Plus, Receipt, Search, Trash2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export function Reembolsables() {
  const [registros, setRegistros] = useState<(Reembolsable & { proveedor_nombre?: string; proveedor_rif?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Reembolsable>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargandoCombos, setCargandoCombos] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [anio, mesNum] = mes.split('-').map(Number);
      const inicio = `${anio}-${String(mesNum).padStart(2, '0')}-01`;
      const fin = mesNum === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mesNum + 1).padStart(2, '0')}-01`;

      const { data, error: err } = await supabase
        .from('reembolsables')
        .select(`
          *,
          proveedores(id, nombre, rif)
        `)
        .gte('fecha', inicio)
        .lt('fecha', fin)
        .order('fecha', { ascending: false });

      if (err) throw err;
      setRegistros(data ?? []);
    } catch (e: any) {
      setRegistros([]);
      setLoadError(e?.message ?? 'Error al cargar los reembolsables.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, [mes]);

  const cargarProveedores = async () => {
    setCargandoCombos(true);
    try {
      const { data } = await supabase.from('proveedores').select('*').order('nombre');
      setProveedores(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoCombos(false);
    }
  };

  useEffect(() => { if (showForm || registros.length === 0) cargarProveedores(); }, [showForm]);

  const resetForm = () => {
    setForm({});
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const openForm = (reg?: Reembolsable) => {
    if (reg) {
      setForm(reg);
      setEditingId(reg.id);
    } else {
      setForm({
        fecha: new Date().toISOString().split('T')[0],
        estado: 'activo',
        costo_total: 0,
        iva: 0,
        total_iva: 0,
      });
      setEditingId(null);
    }
    setShowForm(true);
  };

  const handleChange = (key: string, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const calcIva = (index: number) => {
    // No se aplica en reembolsables individuales, se hace en el submit
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data: any = {
        ...form,
        costo_total: form.costo_total ? Number(form.costo_total) : 0,
        iva: form.iva ? Number(form.iva) : 0,
        total_iva: (form.costo_total ? Number(form.costo_total) : 0) + (form.iva ? Number(form.iva) : 0),
      };
      let result;
      if (editingId) {
        result = await supabase.from('reembolsables').update(data).eq('id', editingId).select().single();
      } else {
        result = await supabase.from('reembolsables').insert(data).select().single();
      }
      if (result.error) throw result.error;
      await cargarDatos();
      resetForm();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este reembolsable?')) return;
    const { error: err } = await supabase.from('reembolsables').delete().eq('id', id);
    if (!err) await cargarDatos();
  };

  const totalGeneral = registros.reduce((a, r) => a + (Number(r.total_iva) || 0), 0);
  const totalIva = registros.reduce((a, r) => a + (Number(r.iva) || 0), 0);
  const totalCosto = registros.reduce((a, r) => a + (Number(r.costo_total) || 0), 0);

  const filtrados = registros.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.proveedor_nombre?.toLowerCase().includes(s) ||
      r.detalle?.toLowerCase().includes(s) ||
      r.factura_n?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reembolsables</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gastos reembolsables por proveedor</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={mes}
            onChange={e => setMes(e.currentTarget.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const anio = new Date().getFullYear();
              const m = String(i + 1).padStart(2, '0');
              return (
                <option key={`${anio}-${m}`} value={`${anio}-${m}`}>
                  {new Date(anio, i).toLocaleDateString('es-VE', { month: 'long' })} {anio}
                </option>
              );
            })}
          </select>
          <Button onClick={() => { resetForm(); openForm(); }} variant="primary">
            <Plus size={16} /> Nuevo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Reembolsables" value={formatCurrency(totalCosto)} icon={<DollarSign size={16} className="text-brand-600" />} />
        <StatCard title="IVA Acumulado" value={formatCurrency(totalIva)} icon={<Receipt size={16} />} />
        <StatCard title="Total con IVA" value={formatCurrency(totalGeneral)} variant="success" />
        <StatCard title="Registros" value={registros.length} subtitle={`mes ${mes}`} />
      </div>

      {/* Error de carga */}
      {loadError && <ErrorAlert message={loadError} onClose={() => setLoadError('')} />}

      {/* Filtro */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Buscar proveedor, factura, detalle..."
            value={search}
            onChange={e => setSearch(e.currentTarget.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-64"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <DataTable
          data={filtrados}
          columns={[
            {
              key: 'fecha',
              header: 'Fecha',
              render: (v) => v ? format(new Date(v), 'dd/MM/yyyy') : '-',
            },
            {
              key: 'proveedor_nombre',
              header: 'Proveedor',
              render: (_, row) => (
                <div>
                  <div className="font-medium text-slate-800 text-sm">{row.proveedor_nombre ?? '-'}</div>
                  <div className="text-xs text-slate-400">{row.proveedor_rif ?? ''}</div>
                </div>
              ),
            },
            {
              key: 'factura_n',
              header: 'Factura Nº',
              render: (v) => <span className="font-mono text-sm text-slate-600">{v ?? '-'}</span>,
            },
            {
              key: 'detalle',
              header: 'Detalle',
              render: (v) => <span className="text-sm text-slate-600 max-w-[200px] truncate">{v ?? '-'}</span>,
            },
            {
              key: 'cuenta_contable',
              header: 'Cuenta Contable',
              render: (v) => <span className="text-xs text-slate-500 font-mono">{v ?? '-'}</span>,
            },
            {
              key: 'costo_total',
              header: 'Costo S/IVA',
              align: 'right',
              render: (v) => <span className="text-slate-800 font-medium">{formatCurrency(v)}</span>,
            },
            {
              key: 'iva',
              header: 'IVA %',
              align: 'right',
              render: (v) => <span className="text-slate-600">{formatCurrency(v)}</span>,
            },
            {
              key: 'total_iva',
              header: 'Total',
              align: 'right',
              render: (v) => <span className="font-semibold text-brand-700">{formatCurrency(v)}</span>,
            },
            {
              key: '',
              header: 'Acciones',
              align: 'center',
              render: (_, row) => (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openForm(row); }} className="p-1.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                    <Receipt size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ),
            },
          ]}
          loading={loading}
          emptyMessage="Sin reembolsables registrados"
          searchKeys={['proveedor_nombre', 'detalle', 'factura_n']}
        />
      </div>

      {/* Formulario modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">{editingId ? 'Editar Reembolsable' : 'Nuevo Reembolsable'}</h2>
              <button onClick={resetForm} className="p-1 rounded text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Fecha *" name="fecha" type="date" value={form.fecha ?? ''} onChange={v => handleChange('fecha', v)} required />
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white w-full"
                  value={form.proveedor_id ?? ''}
                  onChange={e => handleChange('proveedor_id', e.currentTarget.value)}
                  required
                >
                  <option value="">Seleccionar proveedor</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} {p.rif ? `(${p.rif})` : ''}</option>
                  ))}
                </select>
              </div>
              <FormField label="Factura Nº" name="factura_n" type="text" value={form.factura_n ?? ''} onChange={v => handleChange('factura_n', v)} />
              <FormField label="Detalle" name="detalle" type="text" value={form.detalle ?? ''} onChange={v => handleChange('detalle', v)} placeholder="Descripción del gasto" />
              <div className="grid grid-cols-3 gap-3">
                <FormField label="CECO" name="ceco" type="text" value={form.ceco ?? ''} onChange={v => handleChange('ceco', v)} />
                <FormField label="Costo S/IVA (Bs.)" name="costo_total" type="number" value={form.costo_total ?? ''} onChange={v => handleChange('costo_total', v)} step={0.01} required />
                <FormField label="IVA (Bs.)" name="iva" type="number" value={form.iva ?? ''} onChange={v => handleChange('iva', v)} step={0.01} />
              </div>
              <FormField label="Cuenta Contable" name="cuenta_contable" type="text" value={form.cuenta_contable ?? ''} onChange={v => handleChange('cuenta_contable', v)} placeholder="ej: 61701125 - Gastos reembolsables" />
              <FormField label="Categoría" name="categoria" type="text" value={form.categoria ?? ''} onChange={v => handleChange('categoria', v)} />

              <div className="flex justify-end gap-2 mt-3">
                <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>Cancelar</Button>
                <Button type="submit" variant="primary" loading={saving}>{editingId ? 'Actualizar' : 'Crear'}</Button>
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
