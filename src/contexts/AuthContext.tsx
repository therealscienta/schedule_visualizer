import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiFetch } from '../utils/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

interface AuthResponse {
  token: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      apiFetch<User>('/auth/me')
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('authToken');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const syncLocalStorageToServer = useCallback(async () => {
    try {
      const storedSchedules = localStorage.getItem('schedules');
      const storedProjects = localStorage.getItem('projects');
      if (!storedSchedules && !storedProjects) return;

      // Check if user already has data on server
      const serverSchedules = await apiFetch<unknown[]>('/schedules');
      const serverProjects = await apiFetch<unknown[]>('/projects');

      if (serverSchedules.length > 0 || serverProjects.length > 0) return;

      // Upload localStorage projects first
      if (storedProjects) {
        const projects = JSON.parse(storedProjects);
        for (const p of projects) {
          await apiFetch('/projects', {
            method: 'POST',
            body: JSON.stringify({ name: p.name, color: p.color, id: p.id }),
          });
        }
      }

      // Upload localStorage schedules
      if (storedSchedules) {
        const schedules = JSON.parse(storedSchedules);
        await apiFetch('/schedules/sync', {
          method: 'POST',
          body: JSON.stringify({ schedules: schedules.map((s: Record<string, unknown>) => ({
            id: s.id,
            label: s.label,
            cronExpression: s.cronExpression,
            color: s.color,
            durationMinutes: s.durationMinutes || 0,
            projectId: s.projectId || null,
          }))})
        });
      }
    } catch (err) {
      console.warn('localStorage sync failed:', err);
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    await syncLocalStorageToServer();
  }, [syncLocalStorageToServer]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    await syncLocalStorageToServer();
  }, [syncLocalStorageToServer]);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
