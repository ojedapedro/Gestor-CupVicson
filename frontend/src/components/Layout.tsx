import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Coffee,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard',     label: 'Dashboard',         icon: LayoutDashboard, roles: ['admin', 'gerente', 'operador'] },
  { path: '/cup',           label: 'CUP Diario',         icon: ClipboardList,   roles: ['admin', 'gerente', 'operador'] },
  { path: '/guias',         label: 'Guías de Factura',   icon: FileText,        roles: ['admin', 'gerente', 'operador'] },
  { path: '/refrigerios',   label: 'Refrigerios',        icon: Coffee,          roles: ['admin', 'gerente', 'operador'] },
  { path: '/reembolsables', label: 'Reembolsables',      icon: Receipt,         roles: ['admin', 'gerente', 'operador'] },
  { path: '/admin',         label: 'Configuración',      icon: Settings,        roles: ['admin', 'gerente'] },
];

export function Layout({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNav = navItems.filter(item => user && item.roles.includes(user.rol));
  const currentLabel = navItems.find(n => n.path === location.pathname)?.label ?? 'Gestión';

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm">
            VS
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 leading-tight">VICSON</div>
            <div className="text-xs text-slate-500 leading-tight">Gestión</div>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleNav.map(item => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer del sidebar */}
      <div className="p-3 border-t border-slate-200 shrink-0">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
              {user.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">{user.email}</div>
              <div className="text-xs text-slate-500 capitalize">{user.rol}</div>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400">No autenticado</div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* ── Sidebar Desktop (siempre visible ≥ md) ── */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Overlay Mobile ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar Mobile (drawer deslizable) ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 flex flex-col z-50
                    transform transition-transform duration-200 ease-in-out md:hidden
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Botón cerrar en mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Contenido principal ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra superior */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            {/* Botón hamburguesa — solo en mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors md:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold text-slate-700">{currentLabel}</span>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            {new Date().toLocaleDateString('es-VE', { dateStyle: 'long' })}
          </div>
        </header>

        {/* Contenido de la página */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
