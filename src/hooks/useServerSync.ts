import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../utils/api';
import type { Schedule, Project, ServerSchedule, ServerProject } from '../types';

interface ServerSyncResult {
  loadFromServer: () => Promise<{ schedules: Schedule[]; projects: Project[] } | null>;
  saveSchedule: (schedule: Schedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  isAuthenticated: boolean;
}

function serverScheduleToLocal(s: ServerSchedule): Schedule {
  return {
    id: s.id,
    label: s.label,
    cronExpression: s.cronExpression,
    color: s.color,
    durationMinutes: s.durationMinutes,
    projectId: s.projectId || undefined,
  };
}

function serverProjectToLocal(p: ServerProject): Project {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
  };
}

export function useServerSync(): ServerSyncResult {
  const { isAuthenticated } = useAuth();
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;

  const loadFromServer = useCallback(async () => {
    if (!isAuthRef.current) return null;
    try {
      const [serverSchedules, serverProjects] = await Promise.all([
        apiFetch<ServerSchedule[]>('/schedules'),
        apiFetch<ServerProject[]>('/projects'),
      ]);
      return {
        schedules: serverSchedules.map(serverScheduleToLocal),
        projects: serverProjects.map(serverProjectToLocal),
      };
    } catch (err) {
      console.warn('Failed to load from server:', err);
      return null;
    }
  }, []);

  const saveSchedule = useCallback(async (schedule: Schedule) => {
    if (!isAuthRef.current) return;
    try {
      // Try update first, create if 404
      await apiFetch(`/schedules/${schedule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: schedule.label,
          cronExpression: schedule.cronExpression,
          color: schedule.color,
          durationMinutes: schedule.durationMinutes,
          projectId: schedule.projectId || null,
        }),
      });
    } catch {
      try {
        await apiFetch('/schedules', {
          method: 'POST',
          body: JSON.stringify({
            id: schedule.id,
            label: schedule.label,
            cronExpression: schedule.cronExpression,
            color: schedule.color,
            durationMinutes: schedule.durationMinutes,
            projectId: schedule.projectId || null,
          }),
        });
      } catch {
        // Silent failure
      }
    }
  }, []);

  const deleteSchedule = useCallback(async (id: string) => {
    if (!isAuthRef.current) return;
    try {
      await apiFetch(`/schedules/${id}`, { method: 'DELETE' });
    } catch {
      // Silent failure
    }
  }, []);

  const saveProject = useCallback(async (project: Project) => {
    if (!isAuthRef.current) return;
    try {
      await apiFetch(`/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: project.name, color: project.color }),
      });
    } catch {
      try {
        await apiFetch('/projects', {
          method: 'POST',
          body: JSON.stringify({
            id: project.id,
            name: project.name,
            color: project.color,
          }),
        });
      } catch {
        // Silent failure
      }
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    if (!isAuthRef.current) return;
    try {
      await apiFetch(`/projects/${id}`, { method: 'DELETE' });
    } catch {
      // Silent failure
    }
  }, []);

  return {
    loadFromServer,
    saveSchedule,
    deleteSchedule,
    saveProject,
    deleteProject,
    isAuthenticated,
  };
}

export function useServerDataLoader(
  isAuthenticated: boolean,
  setSchedules: (s: Schedule[]) => void,
  setProjects: (p: Project[]) => void,
  loadFromServer: () => Promise<{ schedules: Schedule[]; projects: Project[] } | null>,
): { refreshFromServer: () => void } {
  const hasLoadedRef = useRef(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refreshFromServer = useCallback(() => {
    hasLoadedRef.current = false;
    setRefreshCounter((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    loadFromServer().then((data) => {
      if (data) {
        setSchedules(data.schedules);
        setProjects(data.projects);
      }
    });
  }, [isAuthenticated, refreshCounter, loadFromServer, setSchedules, setProjects]);

  // Reset when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      hasLoadedRef.current = false;
    }
  }, [isAuthenticated]);

  return { refreshFromServer };
}
