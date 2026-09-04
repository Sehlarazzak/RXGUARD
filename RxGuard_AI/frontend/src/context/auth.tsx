import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { storage, KEYS } from '@/lib/storage';
import { api, setToken, getToken } from '@/lib/api';

export type Role = 'patient' | 'doctor' | 'admin';

export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  cnic: string | null;
  phone: string | null;
  license_number: string | null;
  clinic_name: string | null;
  approval_status: string;
  role: Role | null;
  created_at: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: RegisterPayload) => Promise<{ message: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export interface RegisterPayload {
  role: Role;
  fullName: string;
  cnic: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  licenseNumber?: string;
  clinicName?: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Route guards read this to distinguish an intentional logout (send the user to
// the landing page) from an expired/invalid session (send them to Login).
export const authFlags = { logoutIntent: false };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session after page refresh
    (async () => {
      const token = getToken();
      const cached = storage.get(KEYS.user);
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          /* ignore */
        }
      }
      if (token) {
        try {
          const res = await api.get<{ user: UserProfile }>('/auth/me');
          setUser(res.user);
          storage.set(KEYS.user, JSON.stringify(res.user));
        } catch {
          setUser(null);
          storage.remove(KEYS.user);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: UserProfile }>('/auth/login', { email, password });
    setToken(res.token);
    storage.set(KEYS.user, JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const register = async (payload: RegisterPayload) => {
    return api.post<{ message: string }>('/auth/register', {
      role: payload.role,
      fullName: payload.fullName,
      cnic: payload.cnic,
      email: payload.email,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
      phone: payload.phone,
      licenseNumber: payload.licenseNumber,
      clinicName: payload.clinicName,
    });
  };

  const logout = () => {
    authFlags.logoutIntent = true;
    api.post('/auth/logout').catch(() => undefined);
    setToken(null);
    storage.remove(KEYS.user);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.get<{ user: UserProfile }>('/auth/me');
      setUser(res.user);
      storage.set(KEYS.user, JSON.stringify(res.user));
    } catch {
      /* keep current */
    }
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
