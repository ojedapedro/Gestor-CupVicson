import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CupDiario } from './pages/CupDiario';
import { GuiasFact } from './pages/GuiasFact';
import { Refrigerios } from './pages/Refrigerios';
import { Reembolsables } from './pages/Reembolsables';
import { AdminConfig } from './pages/AdminConfig';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-brand-600 font-semibold animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
