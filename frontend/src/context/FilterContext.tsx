import React, { createContext, useContext, useState, useMemo } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FilterContextType {
  /** Mes activo en formato "YYYY-MM" */
  mes: string;
  setMes: (mes: string) => void;

  /** UUID de la sucursal activa, o null para "todas" (solo admin) */
  sucursalId: string | null;
  setSucursalId: (id: string | null) => void;

  /** Opciones de mes generadas para el año actual */
  mesOptions: { value: string; label: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generarMesOptions(): { value: string; label: string }[] {
  const anio = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return {
      value: `${anio}-${m}`,
      label: new Date(anio, i).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }),
    };
  });
}

function getMesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const FilterContext = createContext<FilterContextType | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [mes, setMes] = useState<string>(getMesActual);
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  const mesOptions = useMemo(() => generarMesOptions(), []);

  const value: FilterContextType = {
    mes,
    setMes,
    sucursalId,
    setSucursalId,
    mesOptions,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
}

/** Hook para consumir el contexto de filtros globales */
export function useFilter(): FilterContextType {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilter debe usarse dentro de <FilterProvider>');
  return ctx;
}
