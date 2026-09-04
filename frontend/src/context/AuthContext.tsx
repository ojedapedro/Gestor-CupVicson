import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { UserSucursal } from '../types';

interface AuthState {
  user: {
    id: string;
    email: string;
    rol: 'admin' | 'gerente' | 'operador';
    sucursal_id?: string;
  } | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, nombre: string, sucursal_id?: string) => Promise<{ error?: Error }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ user: null, loading: true });

  const fetchUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setAuth(prev => ({ ...prev, loading: false, user: null }));
      return;
    }

    const { data: usData, error: usErr } = await supabase
      .from('user_sucursal')
      .select('sucursal_id, rol')
      .eq('user_id', session.user.id)
      .single<Pick<UserSucursal, 'sucursal_id' | 'rol'>>();

    if (usErr && usErr.code !== 'PGRST116') {
      console.warn('Error al obtener user_sucursal:', usErr);
    }

    setAuth({
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        rol: (usData?.rol ?? 'operador') as 'admin' | 'gerente' | 'operador',
        sucursal_id: usData?.sucursal_id ?? undefined,
      },
      loading: false,
    });
  }, []);

  useEffect(() => {
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await fetchUser();
      } else if (event === 'SIGNED_OUT') {
        setAuth({ user: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUser]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuth({ user: null, loading: false });
  };

  const signUp = async (email: string, password: string, nombre: string, sucursal_id?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
      },
    });
    if (error) return { error };

    if (sucursal_id) {
      const { error: usErr } = await supabase.from('user_sucursal').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id ?? '',
        sucursal_id,
        rol: 'operador',
      } satisfies Partial<UserSucursal>);
      if (usErr) console.warn('Error al crear user_sucursal:', usErr);
    }

    return {};
  };

  return (
    <AuthContext.Provider value={{ ...auth, signIn, signOut, signUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
