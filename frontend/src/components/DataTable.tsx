import { useState, ReactNode, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  render?: (value: any, row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** Campos del objeto que participan en la búsqueda client-side */
  searchKeys?: (keyof T)[];
  /** Número de filas por página. Default 20. Pasar 0 para deshabilitar paginación */
  pageSize?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SORT_ASC = '↑';
const SORT_DESC = '↓';
const SORT_NEUTRAL = '↕';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="text-slate-300 text-xs">{SORT_NEUTRAL}</span>;
  return <span className="text-brand-600 text-xs">{dir === 'asc' ? SORT_ASC : SORT_DESC}</span>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading,
  emptyMessage = 'Sin datos',
  onRowClick,
  searchKeys = [],
  pageSize = 20,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Resetear página cuando cambia la búsqueda o los datos
  useEffect(() => { setPage(1); }, [search, data.length]);

  // ── Filtrado client-side ──────────────────────────────────────────────────
  const filtered = search && searchKeys.length > 0
    ? data.filter(row => {
        const hay = search.toLowerCase();
        return searchKeys.some(k => {
          const v = row[k];
          return v != null && String(v).toLowerCase().includes(hay);
        });
      })
    : data;

  // ── Ordenamiento ─────────────────────────────────────────────────────────
  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey as keyof T] ?? '';
    const bVal = b[sortKey as keyof T] ?? '';
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // ── Paginación ───────────────────────────────────────────────────────────
  const pagingEnabled = pageSize > 0;
  const totalPages = pagingEnabled ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const paginated = pagingEnabled
    ? sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    : sorted;

  const handleSort = useCallback((key: string) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  // ── Render skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-pulse space-y-1 py-4 px-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 bg-slate-100 rounded" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-2">
        <Search size={28} strokeWidth={1.5} />
        <p className="text-sm">{search ? `Sin resultados para "${search}"` : emptyMessage}</p>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs text-brand-600 hover:underline mt-1"
          >
            Limpiar búsqueda
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Barra de búsqueda */}
      {searchKeys.length > 0 && (
        <div className="px-3 pt-2">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.currentTarget.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                         bg-slate-50 placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-left border-b border-slate-200">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`px-3 py-2.5 font-medium whitespace-nowrap select-none ${
                    col.sortable ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''
                  }`}
                  style={{ textAlign: col.align ?? 'left' }}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <SortIcon active={sortKey === String(col.key)} dir={sortDir} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                className={`${onRowClick ? 'cursor-pointer hover:bg-brand-50/40' : ''} transition-colors`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map(col => (
                  <td
                    key={String(col.key)}
                    className="px-3 py-2.5"
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    {col.render
                      ? col.render(row[col.key as keyof T], row)
                      : String(row[col.key as keyof T] ?? '-')
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: resumen + paginación */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-xs text-slate-500">
        {/* Contador */}
        <span>
          {pagingEnabled && sorted.length > pageSize
            ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} de ${sorted.length} registros`
            : `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`
          }
          {search && filtered.length < data.length && ` (filtrado de ${data.length})`}
        </span>

        {/* Controles de paginación */}
        {pagingEnabled && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <PageButton
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              title="Primera página"
            >
              <ChevronsLeft size={14} />
            </PageButton>
            <PageButton
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              title="Página anterior"
            >
              <ChevronLeft size={14} />
            </PageButton>

            {/* Números de página (máx 5 visibles) */}
            {getPageNumbers(safePage, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1.5 py-1 text-slate-400">…</span>
              ) : (
                <PageButton
                  key={p}
                  onClick={() => setPage(Number(p))}
                  active={p === safePage}
                >
                  {p}
                </PageButton>
              )
            )}

            <PageButton
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              title="Página siguiente"
            >
              <ChevronRight size={14} />
            </PageButton>
            <PageButton
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              title="Última página"
            >
              <ChevronsRight size={14} />
            </PageButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function PageButton({
  children,
  onClick,
  disabled,
  active,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-medium flex items-center justify-center transition-colors
        ${active
          ? 'bg-brand-600 text-white'
          : disabled
            ? 'text-slate-300 cursor-not-allowed'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
    >
      {children}
    </button>
  );
}

/** Genera los números de página con puntos suspensivos si hay muchas páginas */
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
