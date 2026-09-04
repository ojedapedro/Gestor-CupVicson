import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { StatCard } from '../components/StatCard';
import { DataTable } from '../components/DataTable';
import { ErrorAlert } from '../components/ErrorAlert';
import { CupDiario } from '../types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

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

export function Dashboard() {
  const [cups, setCups] = useState<CupDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mes, setMes] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });

  // Leer sucursal del contexto para filtrar (se puede implementar con user_sucursal)
  useEffect(() => {
    cargarDatos();
  }, [mes]);

  const cargarDatos = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [anio, mesNum] = mes.split('-').map(Number);
      const nextMonth = mesNum === 12
        ? `${anio + 1}-01-01`
        : `${anio}-${String(mesNum + 1).padStart(2, '0')}-01`;

      const { data: cupsData, error: cupsErr } = await supabase
        .from('cup_diario')
        .select('*')
        .gte('fecha', `${anio}-${String(mesNum).padStart(2, '0')}-01`)
        .lt('fecha', nextMonth)
        .order('fecha', { ascending: true });

      if (cupsErr) throw cupsErr;
      setCups(cupsData ?? []);
    } catch (e: any) {
      setCups([]);
      setLoadError(e?.message ?? 'Error al cargar datos del Dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // Calcular KPIs
  const totalVentas = cups.reduce((acc, c) => acc + (c.total_venta ?? 0), 0);
  const totalInsumos = cups.reduce((acc, c) => acc + (c.costo_insumos ?? 0), 0);
  const totalDesechables = cups.reduce((acc, c) => acc + (c.desechables ?? 0), 0);
  const totalPersonal = cups.reduce((acc, c) => acc + (c.costo_personal ?? 0), 0);
  const margen = totalVentas - totalInsumos - totalDesechables - totalPersonal;
  const costoPct = totalVentas > 0 ? ((totalInsumos + totalDesechables) / totalVentas) * 100 : 0;
  const diasConDatos = cups.filter(c => c.total_venta && c.total_venta > 0).length;

  // Preparar datos para gráfico de líneas
  const chartData = cups
    .filter(c => c.fecha && c.total_venta)
    .map(c => ({
      fecha: c.fecha ?? '',
      dia: c.dia_semana ?? '',
      venta: Number(c.total_venta ?? 0),
      insumos: Number(c.costo_insumos ?? 0) + Number(c.desechables ?? 0),
      costo_cup: Number(c.costo_cup ?? 0),
    }));

  // Preparar datos para gráfico de barras (desglose por servicio)
  const servicioData = [
    { nombre: 'Almuerzo', valor: cups.reduce((a, c) => a + (c.almuerzo ?? 0), 0) },
    { nombre: 'Cena', valor: cups.reduce((a, c) => a + (c.cena ?? 0), 0) },
    { nombre: 'Desayuno', valor: cups.reduce((a, c) => a + (c.desayuno ?? 0), 0) },
    { nombre: 'Sobrecena', valor: cups.reduce((a, c) => a + (c.sobrecena ?? 0), 0) },
    { nombre: 'Refrigerios', valor: cups.reduce((a, c) => a + (c.refrigerios ?? 0), 0) },
    { nombre: 'Merienda 1', valor: cups.reduce((a, c) => a + (c.merienda_1 ?? 0), 0) },
    { nombre: 'Merienda 2', valor: cups.reduce((a, c) => a + (c.merienda_2 ?? 0), 0) },
    { nombre: 'Cafetín', valor: cups.reduce((a, c) => a + (c.cafetin ?? 0), 0) },
    { nombre: 'Efectivo', valor: cups.reduce((a, c) => a + (c.efectivo ?? 0), 0) },
    { nombre: 'Otros', valor: cups.reduce((a, c) => a + (c.otros ?? 0), 0) },
  ].filter(d => d.valor > 0);

  const fmt = (v: number | null | undefined) => formatCurrency(v);

  const columns: Array<{ key: string; header: string; align?: 'left'|'right'|'center'; sortable?: boolean; render: (v: any, row: any) => React.ReactNode }> = [
    { key: 'fecha', header: 'Fecha', render: (_: any, row: any) => (
      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-slate-400" />
        <span>{new Date(row.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <span className="text-xs text-slate-400 ml-1">{row.dia_semana ?? ''}</span>
      </div>
    )},
    { key: 'total_venta', header: 'Venta Total', align: 'right', render: (v: any) => (
      <span className="font-semibold text-slate-800">{typeof v === 'number' ? fmt(v) : '-'}</span>
    )},
    { key: 'costo_insumos', header: 'Insumos', align: 'right', render: (v: any) => (
      <span className="text-slate-600">{typeof v === 'number' ? fmt(v) : '-'}</span>
    )},
    { key: 'desechables', header: 'Desech/Limp', align: 'right', render: (v: any) => (
      <span className="text-slate-600">{typeof v === 'number' ? fmt(v) : '-'}</span>
    )},
    { key: 'costo_cup', header: 'Costo CUP', align: 'right', render: (v: any) => (
      <span className="text-slate-600">{typeof v === 'number' ? fmt(v) : '-'}</span>
    )},
    { key: 'costo_personal', header: 'Personal', align: 'right', render: (v: any) => (
      <span className="text-slate-600">{typeof v === 'number' ? fmt(v) : '-'}</span>
    )},
    { key: 'total_venta', header: 'Margen', align: 'right', sortable: true, render: (_: any, row: any) => {
      const v = row.total_venta ?? 0;
      const ins = (row.costo_insumos ?? 0) + (row.desechables ?? 0) + (row.costo_personal ?? 0);
      const m = v - ins;
      return (
        <div>
          <div className={`font-medium ${m < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {fmt(m)}
          </div>
        </div>
      );
    }},
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado del módulo */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Resumen operacional del mes</p>
      </div>

      {/* Selector de mes */}
      <div className="flex items-center gap-3">
        <label htmlFor="mes-select" className="text-sm font-medium text-slate-600">Mes:</label>
        <select
          id="mes-select"
          value={mes}
          onChange={e => setMes(e.currentTarget.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        >
          {getMesOptions().map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loadError && <ErrorAlert message={loadError} onClose={() => setLoadError('')} />}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ventas Totales"
          value={fmt(totalVentas)}
          subtitle={`${diasConDatos} días reportados`}
          icon={<DollarSign size={20} />}
          variant="success"
        />
        <StatCard
          title="Costo Insumos"
          value={fmt(totalInsumos + totalDesechables)}
          subtitle={`${costoPct.toFixed(1)}% sobre ventas`}
          icon={<Percent size={20} />}
          variant={costoPct > 60 ? 'danger' : costoPct > 40 ? 'warning' : 'default'}
        />
        <StatCard
          title="Margen Neto"
          value={fmt(margen)}
          subtitle={`Ventas - Insumos - Personal`}
          icon={margen >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          variant={margen >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          title="Promedio Venta/Día"
          value={fmt(diasConDatos > 0 ? totalVentas / diasConDatos : 0)}
          subtitle="Promedio diario"
          icon={<TrendingUp size={20} className="text-brand-600" />}
        />
      </div>

      {/* Gráfico de ventas */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Evolución de Ventas vs Costos</h3>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Sin datos para el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={(v: string) => {
                const d = new Date(v);
                return d.getDate() + '/' + (d.getMonth() + 1);
              }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (Number(v) / 1000).toFixed(0) + 'K'} />
              <Tooltip
                contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0' }}
                formatter={(value: number) => ['Bs.', fmt(value)]}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  return d.toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short' });
                }}
              />
              <Line type="monotone" dataKey="venta" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Venta" />
              <Line type="monotone" dataKey="insumos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Insumos" />
              <Line type="monotone" dataKey="costo_cup" stroke="#64748b" strokeWidth={2} dot={{ r: 3 }} name="Costo CUP" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gráfico de barras — por servicio */}
      {servicioData.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Distribución de Ventas por Servicio</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={servicioData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(value)} />
              <YAxis dataKey="nombre" type="category" width={80} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0' }}
                formatter={(value: number) => ['Bs.', fmt(value)]}
              />
              <Bar dataKey="valor" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla de días */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Detalle por Día</h3>
        <DataTable
          data={cups}
          columns={columns}
          loading={loading}
          emptyMessage="Sin datos para este mes"
          searchKeys={['dia_semana']}
          onRowClick={(_row) => {
            // Navegar al detalle del día (se puede implementar después)
          }}
        />
      </div>

      {/* Alertas rápidas */}
      {costoPct > 80 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertCircle className="text-amber-600 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-medium text-amber-800">Alto costo de insumos</p>
            <p className="text-xs text-amber-600 mt-0.5">
              El {costoPct.toFixed(1)}% de las ventas está siendo absorbido por costos de insumos y desechables.
              Revisá el consumo y los precios de los servicios.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
