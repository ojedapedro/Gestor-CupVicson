import { useEffect, useState } from 'react';
import { formatCurrency } from '../lib/api';
import { supabase } from '../supabase';
import { RefriDiario, ProductoRefri, CupDiario } from '../types';
import { DataTable } from '../components/DataTable';
import { FormField, Button } from '../components/FormField';
import { StatCard } from '../components/StatCard';
import { Plus, Trash2, TrendingUp, Package, Calendar, X } from 'lucide-react';
import { format } from 'date-fns';

export function Refrigerios() {
  const [diarios, setDiarios] = useState<(RefriDiario & { producto?: ProductoRefri; fechaFormatted?: string })[]>([]);
  const [productos, setProductos] = useState<ProductoRefri[]>([]);
  const [cups, setCups] = useState<CupDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<RefriDiario>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [anio, mesNum] = mes.split('-').map(Number);
      const inicio = `${anio}-${String(mesNum).padStart(2, '0')}-01`;
      const fin = `${anio}-${String(mesNum + 1).padStart(2, '0')}-01`;

      const [dRes, pRes, cRes] = await Promise.all([
        supabase
          .from('refri_diario')
          .select(`
            *,
            products:id, nombre, codigo, categoria, precio, unidad
          `)
          .gte('fecha', inicio)
          .lt('fecha', fin)
          .order('fecha', { ascending: true }),
        supabase.from('productos_refri').select('*').order('nombre'),
        supabase.from('cup_diario').select('id, fecha, total_venta').gte('fecha', inicio).lt('fecha', fin),
      ]);

      // Enriquecer
      const enriched = (dRes.data ?? []).map(d => ({
        ...d,
        producto: productos.find(p => p.id === d.producto_id),
        fechaFormatted: d.fecha ? format(new Date(d.fecha), 'dd/MM/yyyy') : '',
      }));
      setDiarios(enriched);
      setProductos(pRes.data ?? []);
      setCups((cRes.data ?? []) as any);
    } catch (e) {
      console.error(e);
      setDiarios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, [mes]);

  const resetForm = () => {
    setForm({});
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const openForm = (reg?: RefriDiario) => {
    if (reg) {
      setForm(reg);
      setEditingId(reg.id);
    } else {
      setForm({
       fecha: new Date().toISOString().split('T')[0],
        producto_id: '',
        cantidad: 0,
        importe: 0,
      });
      setEditingId(null);
    }
    setShowForm(true);
  };

  const handleChange = (key: string, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data: any = {
        ...form,
        cantidad: form.cantidad ? Number(form.cantidad) : 0,
        importe: form.importe ? Number(form.importe) : 0,
      };
      let result;
      if (editingId) {
        result = await supabase.from('refri_diario').update(data).eq('id', editingId).select().single();
      } else {
        result = await supabase.from('refri_diario').insert(data).select().single();
      }
      if (result.error) throw result.error;
      await cargarDatos();
      resetForm();
    } catch (err: any) {
      setError(err.message ?? 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const { error: err } = await supabase.from('refri_diario').delete().eq('id', id);
    if (!err) await cargarDatos();
  };

  const totalVendido = diarios.reduce((a, d) => a + (Number(d.cantidad) || 0), 0);
  const totalImporte = diarios.reduce((a, d) => a + (Number(d.importe) || 0), 0);

  // fmt removed

  const filtrados = diarios.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.producto?.nombre?.toLowerCase().includes(s) || d.fecha?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Refrigerios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro de ventas de refrigerios por día</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={mes}
            onChange={e => setMes(e.currentTarget.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={`${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`}>
                {new Date(2024, i).toLocaleDateString('es-VE', { month: 'long' })} {new Date().getFullYear()}
              </option>
            ))}
          </select>
          <Button onClick={() => openForm()} variant="primary">
            <Plus size={16} /> Nuevo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Cantidad" value={totalVendido} icon={<Package size={16} className="text-brand-600" />} />
        <StatCard title="Total Importe" value={formatCurrency(totalImporte)} icon={<TrendingUp size={16} />} />
        <StatCard title="Días" value={new Set(diarios.map(d => d.fecha)).size} />
        <StatCard title="Productos" value={productos.length} subtitle="activos" />
      </div>

      <div className="flex items-center gap-3 mb-2">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-56"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <DataTable
          data={filtrados}
          columns={[
            { key: 'fechaFormatted', header: 'Fecha', render: (v) => (
              <span className="text-sm text-slate-700">{v ?? '-'}</span>
            )},
            { key: 'producto', header: 'Producto', render: (_, row) => (
              <div className="flex items-center gap-2">
                <Package size={14} className="text-slate-400" />
                <span className="text-sm text-slate-800">{row.producto?.nombre ?? '-'}</span>
                {row.producto?.categoria && (
                  <span className="text-xs text-slate-400 ml-1">({row.producto.categoria})</span>
                )}
              </div>
            )},
            { key: 'cantidad', header: 'Cantidad', align: 'right', render: (v) => (
              <span className="font-medium text-slate-800">{formatCurrency(v)}</span>
            )},
            { key: 'importe', header: 'Importe', align: 'right', render: (v) => (
              <span className="font-medium text-brand-700">{formatCurrency(v)}</span>
            )},
            { key: 'id', header: 'Acciones', align: 'center', render: (_, row) => {
              const r = row as RefriDiario & { producto?: ProductoRefri };
              return (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openForm(r); }} className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50">
                    <Package size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            }},
          ]}
          loading={loading}
          emptyMessage="Sin registros"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? 'Editar' : 'Nuevo'} Refrigerio</h2>
              <button onClick={resetForm} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <FormField label="Fecha" name="fecha" type="date" value={form.fecha ?? ''} onChange={v => handleChange('fecha', v)} required />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  value={form.producto_id ?? ''}
                  onChange={e => handleChange('producto_id', e.currentTarget.value)}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.categoria})</option>
                  ))}
                </select>
                <FormField label="Cantidad" name="cantidad" type="number" value={form.cantidad ?? ''} onChange={v => handleChange('cantidad', v)} min={0} step={0.01} />
              </div>
              <FormField label="Importe (Bs.)" name="importe" type="number" value={form.importe ?? ''} onChange={v => handleChange('importe', v)} step={0.01} />
              <div className="flex justify-end gap-2 mt-3">
                <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>Cancelar</Button>
                <Button type="submit" variant="primary" loading={saving}>{editingId ? 'Guardar' : 'Crear'}</Button>
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
