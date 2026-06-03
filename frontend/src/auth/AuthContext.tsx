import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react';
import { api } from '../api/client';
import {
  getToken, setToken, getStoredUser, setStoredUser, clearAuth,
} from '../lib/auth';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;                 // initial token check finished
  isAuthenticated: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]   = useState<AuthUser | null>(() => getStoredUser());
  const [ready, setReady] = useState(false);

  // Validate any stored token on mount; clear it if the server rejects it.
  useEffect(() => {
    const token = getToken();
    if (!token) { setReady(true); return; }
    api.me()
      .then(res => {
        const u: AuthUser = { userId: res.data.userId, email: res.data.email, role: res.data.role };
        setStoredUser(u);
        setUser(u);
      })
      .catch(() => { clearAuth(); setUser(null); })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    persist(res.data.token!, res.data);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api.register({ email, password });
    persist(res.data.token!, res.data);
  }, []);

  const loginWithToken = useCallback((token: string, u: AuthUser) => {
    setToken(token);
    setStoredUser(u);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  function persist(token: string, data: { userId: number | null; email: string; role: AuthUser['role'] }) {
    const u: AuthUser = { userId: data.userId, email: data.email, role: data.role };
    setToken(token);
    setStoredUser(u);
    setUser(u);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        isAuthenticated: !!user,
        isGuest: user?.role === 'GUEST',
        login,
        register,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
