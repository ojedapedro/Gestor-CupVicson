import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import type { CupDiario, VentaComensal, Servicio, ObjetivoCup, Cliente, Contrato } from '../types';
import { DataTable } from '../components/DataTable';
import { FormField, SelectField, Button } from '../components/FormField';
import { StatCard } from '../components/StatCard';
import {
  Plus,
  Edit3,
  Trash2,
  Calendar,
  TrendingUp,
  FileText,
  Download,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

export function CupDiario() {
  const [cups, setCups] = useState<(CupDiario & { contrato_nombre?: string; sucursal_nombre?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CupDiario>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Contratos y clientes para los selects
  const [contratos, setContratos] = useState<(Contrato & { sucursal_nombre?: string })[]>([]);
  const [clientes, setClientes] = useState<(Cliente & { empresa_nombre?: string })[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoCup[]>([]);
  const [cargandoSelects, setCargandoSelects] = useState(false);

  // Cargar datos del mes
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [anio, mesNum] = mes.split('-').map(Number);
      const inicio = `${anio}-${String(mesNum).padStart(2, '0')}-01`;
      const fin = `${anio}-${String(mesNum + 1).padStart(2, '0')}-01`;

      const { data, error: err } = await supabase
        .from('cup_diario')
        .select(`
          *,
          contratos(nombre, sucursal_id),
          sucursales(nombre)
        `)
        .gte('fecha', inicio)
        .lt('fecha', fin)
        .order('fecha', { ascending: true });

      if (err) throw err;
      setCups(data ?? []);
    } catch (e) {
      console.error(e);
      setCups([]);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Cargar combos
  const cargarCombos = useCallback(async () => {
    setCargandoSelects(true);
    try {
      const [cRes, sRes] = await Promise.all([
        supabase.from('contratos').select('id, nombre, responsable, estado, sucursal_id, sucursales(nombre)'),
        supabase.from('servicios').select('*').order('codigo'),
      ]);
      setContratos((cRes.data ?? []) as any);
      setServicios(sRes.data ?? []);

      if (cups.length > 0) {
        const ids = [...new Set(cups.map(c => c.contrato_id))];
        const { data: objData } = await supabase
          .from('objetivo_cup')
          .select('*')
          .in('contrato_id', ids);
        setObjetivos(objData ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoSelects(false);
    }
  }, [cups]);

  useEffect(() => { cargarCombos(); }, [cargarCombos, cups]);

  // Form handlers
  const resetForm = () => {
    setForm({});
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const openForm = (cup?: CupDiario) => {
    if (cup) {
      setForm(cup);
      setEditingId(cup.id);
    } else {
      setForm({
        fecha: new Date().toISOString().split('T')[0],
        dia_semana: '',
      });
      setEditingId(null);
    }
    setShowForm(true);
  };

  const handleChange = (key: string, value: string | number | null) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = {
        ...form,
        sobrecena: form.sobrecena ? Number(form.sobrecena) : null,
        desayuno: form.desayuno ? Number(form.desayuno) : null,
        almuerzo: form.almuerzo ? Number(form.almuerzo) : null,
        cena: form.cena ? Number(form.cena) : null,
        refrigerios: form.refrigerios ? Number(form.refrigerios) : null,
        merienda_1: form.merienda_1 ? Number(form.merienda_1) : null,
        merienda_2: form.merienda_2 ? Number(form.merienda_2) : null,
        efectivo: form.efectivo ? Number(form.efectivo) : null,
        cafetin: form.cafetin ? Number(form.cafetin) : null,
        otros: form.otros ? Number(form.otros) : null,
        total_venta: form.total_venta ? Number(form.total_venta) : null,
        costo_insumos: form.costo_insumos ? Number(form.costo_insumos) : null,
        desechables: form.desechables ? Number(form.desechables) : null,
        costo_cup: form.costo_cup ? Number(form.costo_cup) : null,
        costo_personal: form.costo_personal ? Number(form.costo_personal) : null,
      };

      let result;
      if (editingId) {
        result = await supabase.from('cup_diario').update(data).eq('id', editingId).select().single();
      } else {
        result = await supabase.from('cup_diario').insert(data).select().single();
      }

      if (result.error) throw result.error;

      // Recalcular total_venta automáticamente si es nueva creación
      await cargarDatos();
      resetForm();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro de CUP? Esta acción no se puede deshacer.')) return;
    const { error: err } = await supabase.from('cup_diario').delete().eq('id', id);
    if (err) {
      alert('Error al eliminar: ' + err.message);
    } else {
      await cargarDatos();
    }
  };

  // Estilo de moneda
  const fmt = (v: number | null | undefined) => {
    if (v == null || v === 0) return '-';
    return 'Bs. ' + Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2 });
  };

  // Resumen rápido del mes
  const totalVenta = cups.reduce((a, c) => a + (c.total_venta ?? 0), 0);
  const totalInsumos = cups.reduce((a, c) => a + (c.costo_insumos ?? 0), 0);
  const totalDesech = cups.reduce((a, c) => a + (c.desechables ?? 0), 0);
  const diasConVenta = cups.filter(c => (c.total_venta ?? 0) > 0).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">CUP Diario</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro de ventas y costos por día</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={mes}
            onChange={e => setMes(e.currentTarget.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={`${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`}>
              {new Date(2024, i).toLocaleDateString('es-VE', { month: 'long' })} {new Date().getFullYear()}
            </option>
          ))}
        </select>
        <Button onClick={() => openForm()} variant="primary">
          <Plus size={16} />
          Nuevo Registro
        </Button>
      </div>
    </div>

    {/* KPIs */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard title="Venta Total" value={fmt(totalVenta)} icon={<TrendingUp size={16} className="text-brand-600" />} />
      <StatCard title="Costo Insumos" value={fmt(totalInsumos)} icon={<FileText size={16} />} />
      <StatCard title="Desechables" value={fmt(totalDesech)} icon={<Download size={16} />} />
      <StatCard title="Días Reportados" value={diasConVenta} subtitle={`de ${cups.length} registrados`} />
    </div>

    {/* Tabla de registros */}
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <DataTable
        data={cups}
        columns={[
          {
            key: 'fecha',
            header: 'Fecha',
            render: (_, row) => (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <div>
                  <div className="font-medium text-slate-800 text-sm">
                    {row.fecha ? format(new Date(row.fecha), 'dd/MM/yyyy') : '-'}
                  </div>
                  <div className="text-xs text-slate-400">{row.dia_semana ?? ''}</div>
                </div>
              </div>
            ),
          },
          {
            key: 'contrato_nombre',
            header: 'Contrato',
            render: (v) => <span className="text-sm text-slate-700">{v ?? '-'}</span>,
          },
          {
            key: 'total_venta',
            header: 'Venta Total',
            align: 'right',
            render: (v) => <span className="font-medium text-slate-800">{fmt(v)}</span>,
          },
          {
            key: 'almuerzo',
            header: 'Almuerzo',
            align: 'right',
            render: (v) => <span className="text-slate-600 text-sm">{fmt(v)}</span>,
          },
          {
            key: 'cena',
            header: 'Cena',
            align: 'right',
            render: (v) => <span className="text-slate-600 text-sm">{fmt(v)}</span>,
          },
          {
            key: 'costo_insumos',
            header: 'Insumos',
            align: 'right',
            render: (v) => <span className="text-slate-600 text-sm">{fmt(v)}</span>,
          },
          {
            key: 'desechables',
            header: 'D/Limp',
            align: 'right',
            render: (v) => <span className="text-slate-600 text-sm">{fmt(v)}</span>,
          },
          {
            key: 'costo_cup',
            header: '% Costo',
            align: 'right',
            render: (_, row) => {
              const tv = row.total_venta ?? 0;
              const ci = (row.costo_insumos ?? 0) + (row.desechables ?? 0);
              if (tv === 0) return <span className="text-slate-400 text-sm">-</span>;
              const pct = (ci / tv) * 100;
              const color = pct > 70 ? 'text-red-600' : pct > 50 ? 'text-amber-600' : 'text-emerald-600';
              return <span className={`font-medium text-sm ${color}`}>{pct.toFixed(1)}%</span>;
            },
          },
          {
            key: '',
            header: '',
            align: 'center',
            render: (_, row) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); openForm(row); }}
                  className="p-1.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  title="Editar"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                  className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]}
        loading={loading}
        emptyMessage="Sin registros para este mes. Presioná + Nuevo Registro para agregar."
        onRowClick={(row) => openForm(row)}
      />
    </div>

    {/* Formulario modal inline */}
    {showForm && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">
              {editingId ? 'Editar Registro CUP' : 'Nuevo Registro CUP'}
            </h2>
            <button
              onClick={resetForm}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <span className="text-lg">&times;</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Fecha"
                name="fecha"
                type="date"
                value={form.fecha ?? ''}
                onChange={v => handleChange('fecha', v)}
                required
              />
              <FormField
                label="Día"
                name="dia_semana"
                type="text"
                value={form.dia_semana ?? ''}
                onChange={v => handleChange('dia_semana', v)}
                placeholder="LUNES, MARTES..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Contrato ID"
                name="contrato_id"
                type="text"
                value={form.contrato_id ?? ''}
                onChange={v => handleChange('contrato_id', v)}
                placeholder="UUID del contrato"
              />
            </div>

            <hr className="border-slate-200" />

            <p className="text-sm font-medium text-slate-600">Ventas por Servicio</p>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Sobrecena" name="sobrecena" type="number" value={form.sobrecena ?? ''} onChange={v => handleChange('sobrecena', v)} step={0.01} />
              <FormField label="Desayuno" name="desayuno" type="number" value={form.desayuno ?? ''} onChange={v => handleChange('desayuno', v)} step={0.01} />
              <FormField label="Almuerzo" name="almuerzo" type="number" value={form.almuerzo ?? ''} onChange={v => handleChange('almuerzo', v)} step={0.01} />
              <FormField label="Cena" name="cena" type="number" value={form.cena ?? ''} onChange={v => handleChange('cena', v)} step={0.01} />
              <FormField label="Refrigerios" name="refrigerios" type="number" value={form.refrigerios ?? ''} onChange={v => handleChange('refrigerios', v)} step={0.01} />
              <FormField label="Merienda 1" name="merienda_1" type="number" value={form.merienda_1 ?? ''} onChange={v => handleChange('merienda_1', v)} step={0.01} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Merienda 2" name="merienda_2" type="number" value={form.merienda_2 ?? ''} onChange={v => handleChange('merienda_2', v)} step={0.01} />
              <FormField label="Efectivo" name="efectivo" type="number" value={form.efectivo ?? ''} onChange={v => handleChange('efectivo', v)} step={0.01} />
              <FormField label="Cafetín" name="cafetin" type="number" value={form.cafetin ?? ''} onChange={v => handleChange('cafetin', v)} step={0.01} />
              <FormField label="Otros" name="otros" type="number" value={form.otros ?? ''} onChange={v => handleChange('otros', v)} step={0.01} />
            </div>

            <hr className="border-slate-200" />

            <p className="text-sm font-medium text-slate-600">Costos</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Costo Insumos (Bs.)" name="costo_insumos" type="number" value={form.costo_insumos ?? ''} onChange={v => handleChange('costo_insumos', v)} step={0.01} />
              <FormField label="Desechables/Limp (Bs.)" name="desechables" type="number" value={form.desechables ?? ''} onChange={v => handleChange('desechables', v)} step={0.01} />
              <FormField label="Costo CUP (Bs.)" name="costo_cup" type="number" value={form.costo_cup ?? ''} onChange={v => handleChange('costo_cup', v)} step={0.01} />
              <FormField label="Costo Personal (Bs.)" name="costo_personal" type="number" value={form.costo_personal ?? ''} onChange={v => handleChange('costo_personal', v)} step={0.01} />
            </div>

            <hr className="border-slate-200" />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={saving} disabled={saving}>
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
