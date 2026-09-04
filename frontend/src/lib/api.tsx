/// Utilidades y helpers para el frontend VICSON

import { supabase } from '../supabase';

// ---------- helpers de formato ----------

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return '-';
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ---------- helpers de estado ----------

export const ESTADO_COLORS: Record<string, string> = {
  activo: 'bg-emerald-100 text-emerald-700',
  inactivo: 'bg-slate-100 text-slate-500',
  vencido: 'bg-red-100 text-red-700',
  pendiente: 'bg-amber-100 text-amber-700',
  facturada: 'bg-blue-100 text-blue-700',
  pagada: 'bg-emerald-100 text-emerald-700',
  anulada: 'bg-red-100 text-red-700',
  aprobado: 'bg-emerald-100 text-emerald-700',
};

export function estadoBadge(estado: string | null | undefined): React.ReactNode {
  if (!estado) return <span className="text-slate-400 text-xs">-</span>;
  const cls = ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {estado}
    </span>
  );
}

// ---------- helpers de Supabase ----------

export async function obtener<T>(
  tabla: string,
  filtros: Record<string, unknown> = {},
  orden?: { columna: string; ascendente?: boolean },
): Promise<T[]> {
  let query = supabase.from(tabla).select('*');

  for (const [key, value] of Object.entries(filtros)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else {
      query = query.eq(key, value);
    }
  }

  if (orden) {
    query = query.order(orden.columna, { ascending: orden.ascendente ?? true });
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Error al obtener ${tabla}:`, error);
    return [];
  }
  return (data ?? []) as T[];
}

export async function obtenerPorId<T>(tabla: string, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(tabla).select('*').eq('id', id).single<T>();
  if (error) {
    console.error(`Error al obtener ${tabla} por id ${id}:`, error);
    return null;
  }
  return data;
}

export async function insertar<T extends Record<string, unknown>>(
  tabla: string,
  datos: T,
): Promise<{ id: string } | null> {
  const { data: resultado, error } = await supabase.from(tabla).insert(datos).select('id').single();
  if (error) {
    console.error(`Error al insertar en ${tabla}:`, error);
    return null;
  }
  return resultado;
}

export async function actualizar<T extends Record<string, unknown>>(
  tabla: string,
  id: string,
  datos: Partial<T>,
): Promise<boolean> {
  const { error } = await supabase.from(tabla).update(datos as Record<string, unknown>).eq('id', id);
  if (error) {
    console.error(`Error al actualizar ${tabla} id=${id}:`, error);
    return false;
  }
  return true;
}

export async function eliminar(tabla: string, id: string): Promise<boolean> {
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) {
    console.error(`Error al eliminar ${tabla} id=${id}:`, error);
    return false;
  }
  return true;
}
