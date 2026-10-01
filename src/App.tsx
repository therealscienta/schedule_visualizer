// src/App.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ScheduleInput } from './components/ScheduleInput';
import { ScheduleList } from './components/ScheduleList';
import { Timeline } from './components/Timeline';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { CustomDateRangePicker } from './components/CustomDateRangePicker';
import { ImportSchedules } from './components/ImportSchedules';
import { ProjectManager } from './components/ProjectManager';
import { ProjectFilter } from './components/ProjectFilter';
import { AuthHeader } from './components/AuthHeader';
import { getColorForIndex } from './utils/colors';
import { generateId } from './utils/id';
import { useSettings } from './contexts/SettingsContext';
import { useAuth } from './contexts/AuthContext';
import { useServerSync, useServerDataLoader } from './hooks/useServerSync';
import { TIME_RANGE_CONFIGS } from './types';
import type { Schedule, Project, TimeRange, TimeFormat, TimelineMode, CustomDateRange } from './types';

const DEFAULT_SCHEDULES: Omit<Schedule, 'id' | 'color'>[] = [
  { label: 'Daily Backup', cronExpression: '0 2 * * *', durationMinutes: 0 },
  { label: 'Hourly Health Check', cronExpression: '0 * * * *', durationMinutes: 0 },
  { label: 'Weekly Report', cronExpression: '0 9 * * 1', durationMinutes: 0 },
];

const TIME_FORMATS: TimeFormat[] = ['12h', '24h'];
const TIMELINE_MODES: { value: TimelineMode; label: string }[] = [
  { value: 'multi', label: 'Multi' },
  { value: 'single', label: 'Single' },
];

function createDefaultSchedules(): Schedule[] {
  return DEFAULT_SCHEDULES.map((schedule, index) => ({
    ...schedule,
    id: generateId(),
    color: getColorForIndex(index),
  }));
}

function loadSchedulesFromStorage(): Schedule[] {
  try {
    const stored = localStorage.getItem('schedules');
    if (stored) {
      const parsed: Schedule[] = JSON.parse(stored);
      // Migration: add durationMinutes if missing
      return parsed.map((s) => ({
        ...s,
        durationMinutes: s.durationMinutes ?? 0,
      }));
    }
  } catch (error) {
    console.error('Failed to load schedules from localStorage:', error);
  }
  return createDefaultSchedules();
}

function loadProjectsFromStorage(): Project[] {
  try {
    const stored = localStorage.getItem('projects');
    if (stored) return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load projects from localStorage:', error);
  }
  return [];
}

function loadCustomDateRangeFromStorage(): CustomDateRange | null {
  try {
    const stored = localStorage.getItem('customDateRange');
    if (stored) {
      const parsed = JSON.parse(stored);
      const range = { startDate: new Date(parsed.startDate), endDate: new Date(parsed.endDate) };
      if (range.startDate.getTime() < range.endDate.getTime()) return range;
    }
  } catch (error) {
    console.error('Failed to load custom date range from localStorage:', error);
  }
  return null;
}

function loadTimeRangeFromStorage(hasCustomRange: boolean): TimeRange {
  const stored = localStorage.getItem('timeRange');
  // A custom range can only be restored together with its dates
  if (stored === 'custom') return hasCustomRange ? 'custom' : '24h';
  return stored && Object.keys(TIME_RANGE_CONFIGS).includes(stored) ? (stored as TimeRange) : '24h';
}

// Imported schedules may reference projects that weren't imported with them; leave those unassigned
function withKnownProjects(schedules: Schedule[], projects: Project[]): Schedule[] {
  const projectIds = new Set(projects.map((p) => p.id));
  return schedules.map((s) => (s.projectId && !projectIds.has(s.projectId) ? { ...s, projectId: undefined } : s));
}

function App() {
  const { isLoading, user } = useAuth();

  // Wait for the session check so a rejected session's cached data is never shown, and
  // remount on sign-in/out so state is re-read from storage for the new identity
  if (isLoading) return null;
  return <ScheduleVisualizer key={user?.id ?? 'guest'} />;
}

function ScheduleVisualizer() {
  const { timeFormat, setTimeFormat, darkMode, setDarkMode, timelineMode, setTimelineMode } = useSettings();
  const { isAuthenticated, user } = useAuth();
  const { loadFromServer, saveSchedule, deleteSchedule: serverDeleteSchedule, saveProject, deleteProject: serverDeleteProject } = useServerSync();

  const [schedules, setSchedules] = useState<Schedule[]>(loadSchedulesFromStorage);
  const [projects, setProjects] = useState<Project[]>(loadProjectsFromStorage);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | null>(null);
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | null>(loadCustomDateRangeFromStorage);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => loadTimeRangeFromStorage(customDateRange !== null));
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load data from server when authenticated
  const setSchedulesCb = useCallback((s: Schedule[]) => setSchedules(s), []);
  const setProjectsCb = useCallback((p: Project[]) => setProjects(p), []);
  const { refreshFromServer } = useServerDataLoader(isAuthenticated, setSchedulesCb, setProjectsCb, loadFromServer);

  // A rejected change leaves the optimistic local state wrong: say so and reload what the server has
  const reportSyncError = useCallback((error: unknown) => {
    setSyncError(error instanceof Error ? error.message : 'Request failed');
    refreshFromServer();
  }, [refreshFromServer]);

  // Auto-refresh data when tab regains focus (for authenticated users)
  const refreshRef = useRef(refreshFromServer);
  refreshRef.current = refreshFromServer;
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthRef.current) {
        refreshRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // What the signed-in user may change; guests can change all of their local data
  const projectRoles = useMemo(() => new Map(projects.map((p) => [p.id, p.role])), [projects]);
  const canEditProject = (project: Project): boolean => !isAuthenticated || project.role !== 'view';
  const canManageProject = (project: Project): boolean => !isAuthenticated || !project.role || project.role === 'owner';
  const ownsSchedule = (schedule: Schedule): boolean =>
    !isAuthenticated || !schedule.ownerId || schedule.ownerId === user?.id;
  const canEditSchedule = (schedule: Schedule): boolean => {
    if (ownsSchedule(schedule)) return true;
    const role = schedule.projectId ? projectRoles.get(schedule.projectId) : undefined;
    return role === 'owner' || role === 'edit';
  };
  const assignableProjects = projects.filter(canEditProject);

  const handleAddSchedule = (label: string, cronExpression: string, durationMinutes: number = 0, projectId?: string): void => {
    const newSchedule: Schedule = {
      id: generateId(),
      label,
      cronExpression,
      color: getColorForIndex(schedules.length),
      durationMinutes,
      projectId,
    };
    setSchedules((prev) => [...prev, newSchedule]);
    saveSchedule(newSchedule).catch(reportSyncError);
  };

  const handleRemoveSchedule = (id: string): void => {
    setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
    serverDeleteSchedule(id).catch(reportSyncError);
  };

  const updateSchedule = (id: string, changes: Partial<Schedule>): void => {
    const schedule = schedules.find((s) => s.id === id);
    if (!schedule) return;
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    saveSchedule({ ...schedule, ...changes }).catch(reportSyncError);
  };

  const handleRenameSchedule = (id: string, newLabel: string): void => {
    updateSchedule(id, { label: newLabel });
  };

  const handleAssignProject = (scheduleId: string, projectId: string | undefined): void => {
    updateSchedule(scheduleId, { projectId });
  };

  const handleAddProject = (name: string, color: string): void => {
    const newProject: Project = { id: generateId(), name, color };
    setProjects((prev) => [...prev, newProject]);
    saveProject(newProject).catch(reportSyncError);
  };

  const handleRemoveProject = (id: string): void => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Own schedules become unassigned, as on the server; other members' schedules leave with the project
    setSchedules((prev) =>
      prev.flatMap((s) => {
        if (s.projectId !== id) return [s];
        return ownsSchedule(s) ? [{ ...s, projectId: undefined }] : [];
      })
    );
    serverDeleteProject(id).catch(reportSyncError);
  };

  const handleRenameProject = (id: string, newName: string): void => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
    saveProject({ ...project, name: newName }).catch(reportSyncError);
  };

  const filteredSchedules = useMemo(() => {
    if (selectedProjectFilter === null) return schedules;
    if (selectedProjectFilter === 'unassigned') {
      // Schedules pointing at a project that isn't listed count as unassigned
      const projectIds = new Set(projects.map((p) => p.id));
      return schedules.filter((s) => !s.projectId || !projectIds.has(s.projectId));
    }
    return schedules.filter((s) => s.projectId === selectedProjectFilter);
  }, [schedules, projects, selectedProjectFilter]);

  // Drop a filter whose project is gone (deleted, unshared or replaced by an import)
  useEffect(() => {
    if (selectedProjectFilter === null) return;
    const isStale = selectedProjectFilter === 'unassigned'
      ? projects.length === 0
      : !projects.some((p) => p.id === selectedProjectFilter);
    if (isStale) setSelectedProjectFilter(null);
  }, [projects, selectedProjectFilter]);

  // Persist schedules to localStorage
  useEffect(() => {
    localStorage.setItem('schedules', JSON.stringify(schedules));
  }, [schedules]);

  // Persist projects to localStorage
  useEffect(() => {
    localStorage.setItem('projects', JSON.stringify(projects));
  }, [projects]);

  // Persist time range to localStorage
  useEffect(() => {
    localStorage.setItem('timeRange', timeRange);
  }, [timeRange]);

  // Persist the custom range too, so a restored 'custom' time range has its dates
  useEffect(() => {
    if (customDateRange) {
      localStorage.setItem('customDateRange', JSON.stringify(customDateRange));
    }
  }, [customDateRange]);

  const handleCustomDateRange = (range: CustomDateRange): void => {
    setCustomDateRange(range);
    setTimeRange('custom');
  };

  const handleImportSchedules = async (imported: { schedules: Schedule[]; projects?: Project[] }): Promise<void> => {
    if (!isAuthenticated) {
      const nextProjects = imported.projects ?? projects;
      setSchedules(withKnownProjects(imported.schedules, nextProjects));
      setProjects(nextProjects);
      return;
    }

    // Signed in: add or update the imported items on the server (nothing there is deleted), then reload
    const importedProjects = imported.projects ?? [];
    const importedSchedules = withKnownProjects(imported.schedules, [...projects, ...importedProjects]);
    const projectResults = await Promise.allSettled(importedProjects.map(saveProject));
    const scheduleResults = await Promise.allSettled(importedSchedules.map(saveSchedule));
    refreshFromServer();

    const results = [...projectResults, ...scheduleResults];
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      throw new Error(`${failed} of ${results.length} imported item(s) could not be saved to the server`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Cron Schedule Visualiser
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Visualize and analyze multiple cron schedules to identify overlaps and optimize timing
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <AuthHeader />
            {isAuthenticated && (
              <button
                onClick={refreshFromServer}
                className="px-3 py-2 rounded-lg text-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title="Refresh data from server"
              >
                &#x21bb;
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-3 py-2 rounded-lg text-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀' : '☾'}
            </button>
          </div>
        </header>

        {syncError && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300"
          >
            <span>Your last change wasn't saved: {syncError}. Showing the latest data from the server.</span>
            <button
              onClick={() => setSyncError(null)}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-200"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1 space-y-4">
            <ScheduleInput onAdd={handleAddSchedule} projects={assignableProjects} />
            <ProjectManager
              projects={projects}
              onAdd={handleAddProject}
              onRemove={handleRemoveProject}
              onRename={handleRenameProject}
              canRename={canEditProject}
              canManage={canManageProject}
            />
            <div className="flex justify-center">
              <ImportSchedules onImport={handleImportSchedules} />
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
            {projects.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <ProjectFilter
                  projects={projects}
                  selectedFilter={selectedProjectFilter}
                  onFilterChange={setSelectedProjectFilter}
                />
              </div>
            )}
            <ScheduleList
              schedules={filteredSchedules}
              projects={projects}
              assignableProjects={assignableProjects}
              onRemove={handleRemoveSchedule}
              onRename={handleRenameSchedule}
              onAssignProject={handleAssignProject}
              canEdit={canEditSchedule}
              canManage={ownsSchedule}
            />
          </div>
        </div>

        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Time Range</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <TimeRangeSelector
                selectedRange={timeRange}
                onRangeChange={setTimeRange}
                onCustomClick={() => setShowCustomPicker(true)}
              />
              <div className="hidden sm:block border-l border-gray-300 dark:border-gray-600 h-8" />
              <div className="flex gap-1">
                {TIME_FORMATS.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setTimeFormat(fmt)}
                    className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timeFormat === fmt
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              <div className="hidden sm:block border-l border-gray-300 dark:border-gray-600 h-8" />
              <div className="flex gap-1">
                {TIMELINE_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setTimelineMode(mode.value)}
                    className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timelineMode === mode.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Timeline
          schedules={filteredSchedules}
          allSchedules={schedules}
          projects={projects}
          timeRange={timeRange}
          customDateRange={customDateRange}
        />

        <CustomDateRangePicker
          isOpen={showCustomPicker}
          onClose={() => setShowCustomPicker(false)}
          onApply={handleCustomDateRange}
          currentRange={customDateRange || undefined}
        />
      </div>
    </div>
  );
}

export default App;
