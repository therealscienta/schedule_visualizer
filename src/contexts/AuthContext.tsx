import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiFetch, ApiError, setUnauthorizedHandler } from '../utils/api';
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

// While signed in, localStorage caches the account's data; it must not outlive the session
function clearCachedAccountData(): void {
  localStorage.removeItem('schedules');
  localStorage.removeItem('projects');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    clearCachedAccountData();
    setUser(null);
  }, []);

  // Sign out whenever the server rejects the session
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      apiFetch<User>('/auth/me')
        .then(setUser)
        .catch((err) => {
          // Only a rejected session ends it; if the server is unreachable, keep the token for next time
          if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 404)) {
            logout();
          } else {
            console.warn('Could not verify session:', err);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [logout]);

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
      const projectIds = new Set<string>();
      if (storedProjects) {
        const projects = JSON.parse(storedProjects);
        for (const p of projects) {
          await apiFetch('/projects', {
            method: 'POST',
            body: JSON.stringify({ name: p.name, color: p.color, id: p.id }),
          });
          projectIds.add(p.id);
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
            // References to projects that weren't uploaded would be rejected
            projectId: typeof s.projectId === 'string' && projectIds.has(s.projectId) ? s.projectId : null,
          }))})
        });
      }
    } catch (err) {
      console.warn('localStorage sync failed:', err);
    }
  }, []);

  const startSession = useCallback(async (data: AuthResponse) => {
    // With a token already present, localStorage holds another session's cached data,
    // not guest data, so it must not be uploaded into this account
    const replacesSession = !!localStorage.getItem('authToken');
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    if (replacesSession) {
      clearCachedAccountData();
    } else {
      await syncLocalStorageToServer();
    }
  }, [syncLocalStorageToServer]);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    await startSession(data);
  }, [startSession]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    await startSession(data);
  }, [startSession]);

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
