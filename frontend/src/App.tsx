import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { CupDiario } from './pages/CupDiario';
import { GuiasFact } from './pages/GuiasFact';
import { Refrigerios } from './pages/Refrigerios';
import { Reembolsables } from './pages/Reembolsables';
import { AdminConfig } from './pages/AdminConfig';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-brand-600 font-semibold animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  
  if (user.rol === 'pendiente') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Cuenta Pendiente</h2>
          <p className="text-slate-600 mb-6">
            Tu cuenta ha sido registrada pero aún no ha sido aprobada por un administrador.
            Comunícate con el administrador para que te asigne un rol y una sucursal.
          </p>
          <button
            onClick={() => {
              signOut();
              navigate('/login');
            }}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (roles && !roles.includes(user.rol)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="cup" element={<CupDiario />} />
                <Route path="guias" element={<GuiasFact />} />
                <Route path="refrigerios" element={<Refrigerios />} />
                <Route path="reembolsables" element={<Reembolsables />} />
                <Route
                  path="admin"
                  element={
                    <ProtectedRoute roles={['admin', 'gerente']}>
                      <AdminConfig />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
