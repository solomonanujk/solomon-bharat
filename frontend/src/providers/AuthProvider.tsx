'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { setAccessToken } from '@/lib/authToken';
import { authService } from '@/modules/auth/services/auth.service';
import { LoginInput, SafeUser } from '@/modules/auth/types';
import { readCookie } from '@/utils/cookies';

const CSRF_COOKIE_NAME = 'csrf_token';

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<SafeUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  readonly children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // The refresh_token cookie is httpOnly, so we can't check it directly. The csrf_token
    // cookie is set alongside it (readable from JS) and acts as a proxy signal — if it's
    // absent, there's no session to restore, so skip the call instead of hitting the API
    // and logging an expected 401 for every guest page load.
    if (!readCookie(CSRF_COOKIE_NAME)) {
      setIsLoading(false);
      return;
    }

    authService
      .refresh()
      .then((result) => {
        setAccessToken(result.accessToken);
        setUser(result.user);
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(input: LoginInput): Promise<SafeUser> {
    const result = await authService.login(input);
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }

  async function logout(): Promise<void> {
    await authService.logout().catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
