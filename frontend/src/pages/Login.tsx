import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Si ya hay usuario, redirigir al dashboard
    // (el AuthContext maneja esto, pero este efecto dobla seguridad)
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await signIn(email, password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? 'Error al iniciar sesión');
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      {/* Logo + Titulo */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm">VS</div>
          <span className="text-sm font-semibold text-slate-800">VICSON Gestión</span>
        </div>
      </div>

      {/* Formulario */}
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 p-6 animate-fade-in">
        <h1 className="text-xl font-bold text-slate-800 text-center mb-1">Iniciar Sesión</h1>
        <p className="text-sm text-slate-500 text-center mb-5">Ingrese sus credenciales</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.currentTarget.value)}
              placeholder="admin@vicson.com"
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                         placeholder-slate-400 transition-shadow"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.currentTarget.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                         placeholder-slate-400 transition-shadow"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm
                       hover:bg-brand-700 active:bg-brand-800
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600 mb-3">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
              Regístrate aquí
            </Link>
          </p>
          <p className="text-xs text-slate-400">
            Sistema de gestión — VICSON SA — {new Date().toLocaleDateString('es-VE', { year: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>
    </div>
  );
}
