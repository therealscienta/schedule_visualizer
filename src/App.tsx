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

function loadSchedulesFromStorage(): Schedule[] {
  try {
    const stored = localStorage.getItem('schedules');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migration: add durationMinutes if missing
      return parsed.map((s: any) => ({
        ...s,
        durationMinutes: s.durationMinutes ?? 0,
      }));
    }
  } catch (error) {
    console.error('Failed to load schedules from localStorage:', error);
  }
  return DEFAULT_SCHEDULES.map((schedule, index) => ({
    ...schedule,
    id: generateId(),
    color: getColorForIndex(index),
  }));
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

function App() {
  const { timeFormat, setTimeFormat, darkMode, setDarkMode, timelineMode, setTimelineMode } = useSettings();
  const { isAuthenticated } = useAuth();
  const { loadFromServer, saveSchedule, deleteSchedule: serverDeleteSchedule, saveProject, deleteProject: serverDeleteProject } = useServerSync();

  const [schedules, setSchedules] = useState<Schedule[]>(loadSchedulesFromStorage);
  const [projects, setProjects] = useState<Project[]>(loadProjectsFromStorage);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const stored = localStorage.getItem('timeRange');
    return (stored as TimeRange) || '24h';
  });
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Load data from server when authenticated
  const setSchedulesCb = useCallback((s: Schedule[]) => setSchedules(s), []);
  const setProjectsCb = useCallback((p: Project[]) => setProjects(p), []);
  const { refreshFromServer } = useServerDataLoader(isAuthenticated, setSchedulesCb, setProjectsCb, loadFromServer);

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
    saveSchedule(newSchedule);
  };

  const handleRemoveSchedule = (id: string): void => {
    setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
    serverDeleteSchedule(id);
  };

  const handleRenameSchedule = (id: string, newLabel: string): void => {
    setSchedules((prev) => {
      const updated = prev.map((schedule) =>
        schedule.id === id ? { ...schedule, label: newLabel } : schedule
      );
      const changed = updated.find((s) => s.id === id);
      if (changed) saveSchedule(changed);
      return updated;
    });
  };

  const handleAssignProject = (scheduleId: string, projectId: string | undefined): void => {
    setSchedules((prev) => {
      const updated = prev.map((schedule) =>
        schedule.id === scheduleId ? { ...schedule, projectId } : schedule
      );
      const changed = updated.find((s) => s.id === scheduleId);
      if (changed) saveSchedule(changed);
      return updated;
    });
  };

  const handleAddProject = (name: string, color: string): void => {
    const newProject: Project = { id: generateId(), name, color };
    setProjects((prev) => [...prev, newProject]);
    saveProject(newProject);
  };

  const handleRemoveProject = (id: string): void => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Unassign schedules from deleted project
    setSchedules((prev) =>
      prev.map((s) => (s.projectId === id ? { ...s, projectId: undefined } : s))
    );
    serverDeleteProject(id);
  };

  const handleRenameProject = (id: string, newName: string): void => {
    setProjects((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, name: newName } : p));
      const changed = updated.find((p) => p.id === id);
      if (changed) saveProject(changed);
      return updated;
    });
  };

  const filteredSchedules = useMemo(() => {
    if (selectedProjectFilter === null) return schedules;
    if (selectedProjectFilter === 'unassigned') return schedules.filter((s) => !s.projectId);
    return schedules.filter((s) => s.projectId === selectedProjectFilter);
  }, [schedules, selectedProjectFilter]);

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

  const handleCustomDateRange = (range: CustomDateRange): void => {
    setCustomDateRange(range);
    setTimeRange('custom');
  };

  const handleImportSchedules = (imported: { schedules: Schedule[]; projects?: Project[] }): void => {
    setSchedules(imported.schedules);
    if (imported.projects) {
      setProjects(imported.projects);
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
              {darkMode ? '\u2600' : '\u263E'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1 space-y-4">
            <ScheduleInput onAdd={handleAddSchedule} projects={projects} />
            <ProjectManager
              projects={projects}
              onAdd={handleAddProject}
              onRemove={handleRemoveProject}
              onRename={handleRenameProject}
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
              onRemove={handleRemoveSchedule}
              onRename={handleRenameSchedule}
              onAssignProject={handleAssignProject}
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
