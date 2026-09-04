import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Si ya hay un usuario y está aprobado, redirigir al dashboard
    if (user && user.rol !== 'pendiente' && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate, authLoading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await signUp(email, password, nombre);
    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? 'Error al registrarse');
    } else {
      setSuccess(true);
      // Supabase automáticamente loguea al usuario después del registro.
      // Dependiendo de la configuración de Supabase (confirm_email), 
      // esto redirigirá automáticamente a App.tsx y detectará el rol 'pendiente'.
    }
  };

  if (success || (user && user.rol === 'pendiente')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Cuenta Pendiente</h2>
          <p className="text-slate-600 mb-6">
            Tu cuenta ha sido creada exitosamente. Actualmente está en espera de que un Administrador la apruebe y te asigne una sucursal.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            Por favor, comunícate con el Administrador del sistema.
          </p>
          <button
            onClick={() => {
              // Sign out so they can log in as a different user if needed
              useAuth().signOut?.();
              navigate('/login');
            }}
            className="inline-block px-4 py-2 bg-brand-50 text-brand-700 font-medium rounded-lg hover:bg-brand-100 transition-colors"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

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
        <h1 className="text-xl font-bold text-slate-800 text-center mb-1">Registro</h1>
        <p className="text-sm text-slate-500 text-center mb-5">Crear una cuenta nueva</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1.5">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={e => setNombre(e.currentTarget.value)}
              placeholder="Juan Pérez"
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.currentTarget.value)}
              placeholder="juan@vicson.com"
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              minLength={6}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password || !nombre}
            className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {submitting ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-sm">
          <p className="text-slate-500">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
