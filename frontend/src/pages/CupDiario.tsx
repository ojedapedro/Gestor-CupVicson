import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import type { CupDiario, Contrato } from '../types';
import { DataTable } from '../components/DataTable';
import { FormField, SelectField, Button } from '../components/FormField';
import { StatCard } from '../components/StatCard';
import { ErrorAlert } from '../components/ErrorAlert';
import {
  Plus,
  Edit3,
  Trash2,
  Calendar,
  TrendingUp,
  FileText,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';

// Genera las opciones de mes para el año actual
function getMesOptions(): { value: string; label: string }[] {
  const anio = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return {
      value: `${anio}-${m}`,
      label: `${new Date(anio, i).toLocaleDateString('es-VE', { month: 'long' })} ${anio}`,
    };
  });
}

const DIAS_SEMANA = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const CAMPOS_VENTA: (keyof CupDiario)[] = [
  'sobrecena', 'desayuno', 'almuerzo', 'cena',
  'refrigerios', 'merienda_1', 'merienda_2',
  'efectivo', 'cafetin', 'otros',
];

export function CupDiario() {
  const [cups, setCups] = useState<(CupDiario & { contratos?: { nombre: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });

  const mesOptions = useMemo(() => getMesOptions(), []);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CupDiario>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Contratos para el select
  const [contratos, setContratos] = useState<(Contrato & { sucursales?: { nombre: string } })[]>([]);
  const [cargandoSelects, setCargandoSelects] = useState(false);

  // Cargar datos del mes
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [anio, mesNum] = mes.split('-').map(Number);
      const inicio = `${anio}-${String(mesNum).padStart(2, '0')}-01`;
      const fin = `${anio}-${String(mesNum + 1).padStart(2, '0')}-01`;

      const { data, error: err } = await supabase
        .from('cup_diario')
        .select(`*, contratos(nombre)`)
        .gte('fecha', inicio)
        .lt('fecha', fin)
        .order('fecha', { ascending: true });

      if (err) throw err;
      setCups((data ?? []) as any);
    } catch (e: any) {
      console.error(e);
      setLoadError(e?.message ?? 'Error al cargar los datos del CUP.');
      setCups([]);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Cargar contratos activos para el select
  const cargarContratos = useCallback(async () => {
    setCargandoSelects(true);
    try {
      const { data } = await supabase
        .from('contratos')
        .select('id, nombre, estado, sucursal_id, sucursales(nombre)')
        .eq('estado', 'activo')
        .order('nombre');
      setContratos((data ?? []) as any);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoSelects(false);
    }
  }, []);

  useEffect(() => { cargarContratos(); }, [cargarContratos]);

  // Recalcular total_venta sumando todos los campos de venta
  const calcularTotalVenta = (f: Partial<CupDiario>) =>
    Number(CAMPOS_VENTA.reduce((acc, k) => acc + (Number(f[k]) || 0), 0).toFixed(2));

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
      const today = new Date();
      setForm({
        fecha: today.toISOString().split('T')[0],
        dia_semana: DIAS_SEMANA[today.getDay()],
      });
      setEditingId(null);
    }
    setShowForm(true);
  };

  const handleChange = (key: string, value: string | number | null) => {
    setForm(prev => {
      const updated = { ...prev, [key]: value };
      // Auto-recalculo de total_venta al modificar cualquier campo de venta
      if (CAMPOS_VENTA.includes(key as keyof CupDiario)) {
        updated.total_venta = calcularTotalVenta(updated);
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contrato_id) { setError('Debes seleccionar un contrato.'); return; }
    setSaving(true);
    setError('');

    try {
      const payload: Record<string, any> = { ...form };
      // Convertir todos los campos numéricos
      const numericFields: (keyof CupDiario)[] = [
        ...CAMPOS_VENTA, 'total_venta', 'costo_insumos', 'desechables', 'costo_cup', 'costo_personal',
      ];
      for (const k of numericFields) {
        payload[k] = payload[k] !== undefined && payload[k] !== '' ? Number(payload[k]) : null;
      }
      // Asegurar que total_venta esté calculado
      payload.total_venta = calcularTotalVenta(payload as Partial<CupDiario>);

      let result;
      if (editingId) {
        result = await supabase.from('cup_diario').update(payload).eq('id', editingId).select().single();
      } else {
        result = await supabase.from('cup_diario').insert(payload).select().single();
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
    if (!confirm('¿Eliminar este registro de CUP? Esta acción no se puede deshacer.')) return;
    const { error: err } = await supabase.from('cup_diario').delete().eq('id', id);
    if (err) {
      alert('Error al eliminar: ' + err.message);
    } else {
      await cargarDatos();
    }
  };

  // Resumen rápido del mes
  const totalVenta = cups.reduce((a, c) => a + (c.total_venta ?? 0), 0);
  const totalInsumos = cups.reduce((a, c) => a + (c.costo_insumos ?? 0), 0);
  const totalDesech = cups.reduce((a, c) => a + (c.desechables ?? 0), 0);
  const diasConVenta = cups.filter(c => (c.total_venta ?? 0) > 0).length;

  // Total calculado en tiempo real del formulario
  const totalFormulario = calcularTotalVenta(form);

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
            {mesOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button onClick={() => openForm()} variant="primary">
            <Plus size={16} />
            Nuevo Registro
          </Button>
        </div>
      </div>

      {/* Error de carga */}
      {loadError && <ErrorAlert message={loadError} onClose={() => setLoadError('')} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Venta Total" value={formatCurrency(totalVenta)} icon={<TrendingUp size={16} className="text-brand-600" />} />
        <StatCard title="Costo Insumos" value={formatCurrency(totalInsumos)} icon={<FileText size={16} />} />
        <StatCard title="Desechables" value={formatCurrency(totalDesech)} icon={<Download size={16} />} />
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
                      {row.fecha ? format(new Date(row.fecha + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                    </div>
                    <div className="text-xs text-slate-400">{row.dia_semana ?? ''}</div>
                  </div>
                </div>
              ),
            },
            {
              key: 'contrato_id',
              header: 'Contrato',
              render: (_, row) => (
                <span className="text-sm text-slate-700">
                  {(row as any).contratos?.nombre ?? '-'}
                </span>
              ),
            },
            {
              key: 'total_venta',
              header: 'Venta Total',
              align: 'right',
              sortable: true,
              render: (v) => <span className="font-medium text-slate-800">{formatCurrency(v)}</span>,
            },
            {
              key: 'almuerzo',
              header: 'Almuerzo',
              align: 'right',
              render: (v) => <span className="text-slate-600 text-sm">{formatCurrency(v)}</span>,
            },
            {
              key: 'cena',
              header: 'Cena',
              align: 'right',
              render: (v) => <span className="text-slate-600 text-sm">{formatCurrency(v)}</span>,
            },
            {
              key: 'costo_insumos',
              header: 'Insumos',
              align: 'right',
              render: (v) => <span className="text-slate-600 text-sm">{formatCurrency(v)}</span>,
            },
            {
              key: 'desechables',
              header: 'D/Limp',
              align: 'right',
              render: (v) => <span className="text-slate-600 text-sm">{formatCurrency(v)}</span>,
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

      {/* Formulario modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
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

            <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Fecha y día */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Fecha *"
                  name="fecha"
                  type="date"
                  value={form.fecha ?? ''}
                  onChange={v => handleChange('fecha', v)}
                  required
                />
                <FormField
                  label="Día semana"
                  name="dia_semana"
                  type="text"
                  value={form.dia_semana ?? ''}
                  onChange={v => handleChange('dia_semana', v)}
                  placeholder="LUNES, MARTES..."
                />
              </div>

              {/* Contrato — SELECT real, no UUID */}
              <SelectField
                label="Contrato *"
                name="contrato_id"
                options={contratos.map(c => ({
                  value: c.id,
                  label: c.nombre + (c.sucursales?.nombre ? ` — ${c.sucursales.nombre}` : ''),
                }))}
                value={form.contrato_id ?? ''}
                onChange={v => handleChange('contrato_id', v)}
                required
                placeholder={cargandoSelects ? 'Cargando contratos...' : 'Seleccionar contrato activo'}
              />

              <hr className="border-slate-200" />

              {/* Total calculado en tiempo real */}
              <div className="bg-brand-50 border border-brand-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium text-brand-700">Total Venta (auto-calculado)</span>
                <span className="text-lg font-bold text-brand-700">
                  {totalFormulario > 0 ? formatCurrency(totalFormulario) : '-'}
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-600">Ventas por Servicio (Bs.)</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Sobrecena" name="sobrecena" type="number" value={form.sobrecena ?? ''} onChange={v => handleChange('sobrecena', v)} step={0.01} min={0} />
                <FormField label="Desayuno" name="desayuno" type="number" value={form.desayuno ?? ''} onChange={v => handleChange('desayuno', v)} step={0.01} min={0} />
                <FormField label="Almuerzo" name="almuerzo" type="number" value={form.almuerzo ?? ''} onChange={v => handleChange('almuerzo', v)} step={0.01} min={0} />
                <FormField label="Cena" name="cena" type="number" value={form.cena ?? ''} onChange={v => handleChange('cena', v)} step={0.01} min={0} />
                <FormField label="Refrigerios" name="refrigerios" type="number" value={form.refrigerios ?? ''} onChange={v => handleChange('refrigerios', v)} step={0.01} min={0} />
                <FormField label="Merienda 1" name="merienda_1" type="number" value={form.merienda_1 ?? ''} onChange={v => handleChange('merienda_1', v)} step={0.01} min={0} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Merienda 2" name="merienda_2" type="number" value={form.merienda_2 ?? ''} onChange={v => handleChange('merienda_2', v)} step={0.01} min={0} />
                <FormField label="Efectivo" name="efectivo" type="number" value={form.efectivo ?? ''} onChange={v => handleChange('efectivo', v)} step={0.01} min={0} />
                <FormField label="Cafetín" name="cafetin" type="number" value={form.cafetin ?? ''} onChange={v => handleChange('cafetin', v)} step={0.01} min={0} />
                <FormField label="Otros" name="otros" type="number" value={form.otros ?? ''} onChange={v => handleChange('otros', v)} step={0.01} min={0} />
              </div>

              <hr className="border-slate-200" />

              <p className="text-sm font-semibold text-slate-600">Costos (Bs.)</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Costo Insumos" name="costo_insumos" type="number" value={form.costo_insumos ?? ''} onChange={v => handleChange('costo_insumos', v)} step={0.01} min={0} />
                <FormField label="Desechables/Limp" name="desechables" type="number" value={form.desechables ?? ''} onChange={v => handleChange('desechables', v)} step={0.01} min={0} />
                <FormField label="Costo CUP" name="costo_cup" type="number" value={form.costo_cup ?? ''} onChange={v => handleChange('costo_cup', v)} step={0.01} min={0} />
                <FormField label="Costo Personal" name="costo_personal" type="number" value={form.costo_personal ?? ''} onChange={v => handleChange('costo_personal', v)} step={0.01} min={0} />
              </div>

              <hr className="border-slate-200" />

              <div className="flex justify-end gap-3 pt-1">
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
