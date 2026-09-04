import { useState, ReactNode } from 'react';

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: keyof T | string;
    header: string;
    render?: (value: any, row: T) => ReactNode;
    align?: 'left' | 'right' | 'center';
    sortable?: boolean;
  }[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  searchKeys?: (keyof T)[];
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading,
  emptyMessage = 'Sin datos',
  onRowClick,
  searchKeys = [],
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const filtered = search
    ? data.filter(row => {
        const hay = search.toLowerCase();
        return searchKeys.some(k => {
          const v = row[k];
          return v != null && String(v).toLowerCase().includes(hay);
        });
      })
    : data;

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey as keyof T] ?? '';
    const bVal = b[sortKey as keyof T] ?? '';
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIcon = (key: string) => {
    if (sortKey !== key) return <span className="text-slate-300 text-xs">↕</span>;
    return sortDir === 'asc' ? <span className="text-brand-600 text-xs">↑</span> : <span className="text-brand-600 text-xs">↓</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm animate-pulse">
        Cargando...
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {search && searchKeys.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.currentTarget.value)}
            className="flex-1 max-w-xs px-3 py-1.5 border border-slate-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-left">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`px-3 py-2.5 font-medium whitespace-nowrap ${
                    col.sortable ? 'cursor-pointer select-none hover:bg-slate-100' : ''
                  }`}
                  style={{ textAlign: col.align ?? 'left' }}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.header}</span>
                    {col.sortable && sortIcon(String(col.key))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sorted.map((row, idx) => {
              const isClickable = !!onRowClick;
              return (
                <tr
                  key={idx}
                  className={`${isClickable ? 'cursor-pointer hover:bg-brand-50/50' : ''} transition-colors`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <td key={String(col.key)} className="px-3 py-2.5" style={{ textAlign: col.align ?? 'left' }}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        {filtered.length} de {data.length} registros
      </div>
    </div>
  );
}
