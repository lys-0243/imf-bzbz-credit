import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  zoneId?: string | null;
  zone?: { id: string; name: string; code?: string } | null;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return;
    }
    const me = await api<AuthUser>('/me');
    setUser(me);
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } catch {
        await setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const res = await api<{ accessToken: string; user: AuthUser }>(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          },
        );
        await setToken(res.accessToken);
        setUser(res.user);
      },
      async logout() {
        await setToken(null);
        setUser(null);
      },
      refreshMe,
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AuthProvider manquant');
  return ctx;
}
