import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { GuiaFact, GuiaDetalle, Cliente, Servicio, Sucursal } from '../types';
import { DataTable } from '../components/DataTable';
import { FormField, SelectField, Button } from '../components/FormField';
import { StatCard } from '../components/StatCard';
import {
  Plus,
  FileText,
  Search,
  Download,
  Eye,
  EyeOff,
} from 'lucide-react';
import { format } from 'date-fns';

export function GuiasFact() {
  const [guias, setGuias] = useState<(GuiaFact & { clientes?: Pick<Cliente, 'nombre' | 'rif'> | null; sucursales?: Pick<Sucursal, 'nombre' | 'codigo'> | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<GuiaFact>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [detalles, setDetalles] = useState<Partial<GuiaDetalle>[]>([]);
  const [clientes, setClientes] = useState<(Cliente & { empresa_nombre?: string })[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [cargandoCombos, setCargandoCombos] = useState(false);

  const cargarGuias = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('guias_fact')
        .select(`
          *,
          clientes(id, nombre, rif),
          sucursales(id, nombre, codigo)
        `)
        .order('fecha', { ascending: false });

      if (estadoFilter) {
        query = query.eq('estado', estadoFilter);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setGuias(data ?? []);
    } catch (e) {
      console.error(e);
      setGuias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarGuias(); }, [estadoFilter]);

  const cargarCombos = async () => {
    setCargandoCombos(true);
    try {
      const [cRes, sRes, suRes] = await Promise.all([
        supabase.from('clientes').select('*').order('nombre'),
        supabase.from('servicios').select('*').order('codigo'),
        supabase.from('sucursales').select('id, nombre, codigo').eq('estado', 'activo'),
      ]);
      setClientes(cRes.data ?? []);
      setServicios(sRes.data ?? []);
      setSucursales((suRes.data ?? []) as any);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoCombos(false);
    }
  };

  useEffect(() => { cargarCombos(); }, []);

  const resetForm = () => {
    setForm({});
    setDetalles([]);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const openForm = (guia?: GuiaFact) => {
    if (guia) {
      setForm(guia);
      setEditingId(guia.id);
      // Cargar detalles asociados
      supabase
        .from('guias_detalle')
        .select('*')
        .eq('guia_id', guia.id)
        .order('orden')
        .then(({ data }) => setDetalles(data ?? []));
    } else {
      setForm({
        fecha: new Date().toISOString().split('T')[0],
        estado: 'pendiente',
      });
      setEditingId(null);
      setDetalles([]);
    }
    setShowForm(true);
  };

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleDetalleChange = (index: number, key: string, value: string | number) => {
    setDetalles(prev => prev.map((d, i) => {
      if (i !== index) return d;
      if (key === 'cantidad' || key === 'precio_unit' || key === 'importe') {
        return { ...d, [key]: value === '' ? 0 : Number(value) };
      }
      return { ...d, [key]: value };
    }));
  };

  const addDetalle = () => {
    setDetalles(prev => [...prev, {
      servicio_id: '',
      cantidad: 1,
      precio_unit: 0,
      importe: 0,
      orden: prev.length,
    }]);
  };

  const removeDetalle = (index: number) => {
    setDetalles(prev => prev.filter((_, i) => i !== index));
  };

  const calcularImporte = (index: number) => {
    const d = detalles[index];
    if (d.cantidad && d.precio_unit) {
      const importe = Number(d.cantidad) * Number(d.precio_unit);
      handleDetalleChange(index, 'importe', importe.toFixed(2));
    }
  };

  const totalGuia = detalles.reduce((acc, d) => acc + (Number(d.importe) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Calcular importes finales
    const detallesFinal = detalles.map(d => ({
      servicio_id: d.servicio_id,
      cantidad: d.cantidad ? Number(d.cantidad) : 0,
      precio_unit: d.precio_unit ? Number(d.precio_unit) : 0,
      importe: d.importe ? Number(d.importe) : 0,
      orden: d.orden ?? 0,
    }));

    try {
      const guiaData: any = {
        ...form,
        fecha: form.fecha,
        sucursal_id: form.sucursal_id,
        cliente_id: form.cliente_id,
        numero_guia: form.numero_guia,
        periodo_ini: form.periodo_ini,
        periodo_fin: form.periodo_fin,
        no_oc: form.no_oc,
        factura_n: form.factura_n,
        estado: form.estado ?? 'pendiente',
      };

      let result;
      if (editingId) {
        result = await supabase.from('guias_fact').update(guiaData).eq('id', editingId).select().single();
        if (result.error) throw result.error;
        // Eliminar detalles viejos y crear nuevos
        await supabase.from('guias_detalle').delete().eq('guia_id', editingId);
        for (const det of detallesFinal) {
          await supabase.from('guias_detalle').insert({
            ...det,
            guia_id: editingId,
          });
        }
      } else {
        result = await supabase.from('guias_fact').insert(guiaData).select().single();
        if (result.error) throw result.error;
        const guiaId = result.data?.id;
        if (!guiaId) throw new Error('No se pudo crear la guía');
        for (const det of detallesFinal) {
          await supabase.from('guias_detalle').insert({
            ...det,
            guia_id: guiaId,
          });
        }
      }

      resetForm();
      await cargarGuias();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta guía? Los detalles asociados también serán eliminados.')) return;
    const { error: err } = await supabase.from('guias_fact').delete().eq('id', id);
    if (err) {
      alert('Error: ' + err.message);
    } else {
      await cargarGuias();
    }
  };

  const cambioEstado = async (id: string, nuevoEstado: string) => {
    const { error: err } = await supabase.from('guias_fact').update({ estado: nuevoEstado }).eq('id', id);
    if (err) {
      alert('Error: ' + err.message);
    } else {
      await cargarGuias();
    }
  };

  const fmt = (v: number | null | undefined) => {
    if (v == null || v === 0) return '-';
    return 'Bs. ' + Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2 });
  };

  const filtrados = guias.filter(g => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      g.numero_guia.toLowerCase().includes(s) ||
      g.clientes?.nombre?.toLowerCase().includes(s) ||
      g.factura_n?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Guías de Facturación</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro de facturas y guías emitidas</p>
        </div>
        <Button onClick={() => { resetForm(); openForm(); }} variant="primary">
          <Plus size={16} />
          Nueva Guía
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Buscar guía, cliente, factura..."
            value={search}
            onChange={e => setSearch(e.currentTarget.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-64
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.currentTarget.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="facturada">Facturada</option>
          <option value="pagada">Pagada</option>
          <option value="anulada">Anulada</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Guías" value={guias.length} />
        <StatCard title="Pendientes" value={guias.filter(g => g.estado === 'pendiente').length} variant="warning" />
        <StatCard title="Facturadas" value={guias.filter(g => g.estado === 'facturada').length} variant="success" />
        <StatCard title="Pagadas" value={guias.filter(g => g.estado === 'pagada').length} />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <DataTable
          data={filtrados}
          columns={[
            {
              key: 'numero_guia',
              header: 'Nº Guía',
              render: (v) => (
                <span className="font-mono font-medium text-slate-800">{v ?? '-'}</span>
              ),
            },
            {
              key: 'fecha',
              header: 'Fecha',
              render: (v) => v ? format(new Date(v), 'dd/MM/yyyy') : '-',
            },
            {
              key: 'cliente',
              header: 'Cliente',
              render: (_, row) => (
                <div>
                  <div className="text-sm font-medium text-slate-800">{row.clientes?.nombre ?? "-"}</div>
                  <div className="text-xs text-slate-400">{row.clientes?.rif ?? ''}</div>
                </div>
              ),
            },
            {
              key: 'sucursales',
              header: 'Sucursal',
              render: (_, row) => (
                <div>
                  <div className="text-sm text-slate-700">{row.sucursales?.nombre ?? '-'}</div>
                  <div className="text-xs text-slate-400">{row.sucursales?.codigo ?? ''}</div>
                </div>
              ),
            },
            {
              key: 'factura_n',
              header: 'Factura Nº',
              render: (v) => <span className="text-sm text-slate-600">{v ?? '-'}</span>,
            },
            {
              key: 'estado',
              header: 'Estado',
              align: 'center',
              render: (v) => {
                const estado = v as string;
                const colors: Record<string, string> = {
                  pendiente: 'bg-amber-100 text-amber-700',
                  facturada: 'bg-blue-100 text-blue-700',
                  pagada: 'bg-emerald-100 text-emerald-700',
                  anulada: 'bg-red-100 text-red-700',
                };
                const cls = colors[estado] ?? 'bg-slate-100 text-slate-600';
                return (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
                    {estado}
                  </span>
                );
              },
            },
            {
              key: '',
              header: 'Acciones',
              align: 'center',
              render: (_, row) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); cambioEstado(row.id, row.estado === 'pagada' ? 'pendiente' : 'pagada'); }}
                    className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title={row.estado === 'pagada' ? 'Marcar como pendiente' : 'Marcar como pagada'}
                  >
                    {row.estado === 'pagada' ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openForm(row); }}
                    className="p-1.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    title="Editar"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <span className="text-base leading-none">×</span>
                  </button>
                </div>
              ),
            },
          ]}
          loading={loading}
          emptyMessage="Sin guías registradas"
          searchKeys={['numero_guia', 'cliente.nombre', 'factura_n']}
        />
      </div>

      {/* Formulario modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingId ? 'Editar Guía' : 'Nueva Guía de Facturación'}
              </h2>
              <button onClick={resetForm} className="p-1 rounded text-slate-400 hover:text-slate-600">
                <span className="text-xl leading-none">&times;</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Header de la guía */}
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Sucursal *"
                  name="sucursal_id"
                  options={sucursales.map(s => ({ value: s.id, label: `${s.nombre} (${s.codigo})` }))}
                  value={form.sucursal_id ?? ''}
                  onChange={v => handleChange('sucursal_id', v)}
                  required
                />
                <SelectField
                  label="Cliente *"
                  name="cliente_id"
                  options={clientes.map(c => ({ value: c.id, label: c.nombre + (c.rif ? ` (${c.rif})` : '') }))}
                  value={form.cliente_id ?? ''}
                  onChange={v => handleChange('cliente_id', v)}
                  required
                />
                <FormField label="Nº Guía *" name="numero_guia" type="text" value={form.numero_guia ?? ''} onChange={v => handleChange('numero_guia', v)} required />
                <FormField label="Fecha *" name="fecha" type="date" value={form.fecha ?? ''} onChange={v => handleChange('fecha', v)} required />
                <FormField label="Periodo Inicio" name="periodo_ini" type="date" value={form.periodo_ini ?? ''} onChange={v => handleChange('periodo_ini', v)} />
                <FormField label="Periodo Fin" name="periodo_fin" type="date" value={form.periodo_fin ?? ''} onChange={v => handleChange('periodo_fin', v)} />
                <FormField label="Nº O/C" name="no_oc" type="text" value={form.no_oc ?? ''} onChange={v => handleChange('no_oc', v)} />
                <FormField label="Factura Nº" name="factura_n" type="text" value={form.factura_n ?? ''} onChange={v => handleChange('factura_n', v)} />
                <SelectField
                  label="Estado"
                  name="estado"
                  options={[
                    { value: 'pendiente', label: 'Pendiente' },
                    { value: 'facturada', label: 'Facturada' },
                    { value: 'pagada', label: 'Pagada' },
                    { value: 'anulada', label: 'Anulada' },
                  ]}
                  value={form.estado ?? 'pendiente'}
                  onChange={v => handleChange('estado', v)}
                />
              </div>

              <hr className="border-slate-200" />

              {/* Detalles de servicios */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-600">Servicios / Líneas</p>
                  <Button type="button" variant="secondary" size="sm" onClick={addDetalle} disabled={cargandoCombos}>
                    <Plus size={14} />
                    Agregar Servicio
                  </Button>
                </div>

                {cargandoCombos ? (
                  <div className="text-center py-4 text-slate-400 text-sm">Cargando servicios...</div>
                ) : (
                  <div className="space-y-2">
                    {detalles.map((det, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex-1">
                          <SelectField
                            label=""
                            name={`servicio_${idx}`}
                            options={servicios.map(s => ({ value: s.id, label: `${s.codigo} - ${s.nombre}` }))}
                            value={det.servicio_id ?? ''}
                            onChange={v => {
                              handleDetalleChange(idx, 'servicio_id', v);
                              // Auto-precio desde servicio
                              const servicio = servicios.find(s => s.id === v);
                              if (servicio?.precio_vigente) {
                                handleDetalleChange(idx, 'precio_unit', servicio.precio_vigente.toString());
                              }
                            }}
                            placeholder="Seleccionar servicio"
                          />
                        </div>
                        <div className="w-20">
                          <input
                            type="number"
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right"
                            value={det.cantidad ?? 1}
                            onChange={e => handleDetalleChange(idx, 'cantidad', e.currentTarget.value)}
                            min="1"
                          />
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right"
                            value={det.precio_unit ?? 0}
                            onChange={e => handleDetalleChange(idx, 'precio_unit', e.currentTarget.value)}
                            step="0.01"
                          />
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right font-medium"
                            value={det.importe ?? 0}
                            onChange={e => handleDetalleChange(idx, 'importe', e.currentTarget.value)}
                            step="0.01"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDetalle(idx)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <span className="text-lg">×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {detalles.length > 0 && (
                  <div className="mt-2 flex justify-end">
                    <div className="text-sm font-medium text-slate-700 mr-4">
                      Total: <span className="text-brand-600">{fmt(totalGuia)}</span>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-slate-200" />

              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>Cancelar</Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {editingId ? 'Actualizar' : 'Crear Guía'}
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
