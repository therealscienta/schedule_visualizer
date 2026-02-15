// src/components/ScheduleList.tsx

import { useState } from 'react';
import type { Schedule, Project } from '../types';

interface ScheduleListProps {
  schedules: Schedule[];
  projects?: Project[];
  onRemove: (id: string) => void;
  onRename: (id: string, newLabel: string) => void;
  onAssignProject?: (scheduleId: string, projectId: string | undefined) => void;
}

export function ScheduleList({ schedules, projects = [], onRemove, onRename, onAssignProject }: ScheduleListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const startEditing = (schedule: Schedule): void => {
    setEditingId(schedule.id);
    setEditLabel(schedule.label);
  };

  const saveEdit = (): void => {
    if (editingId && editLabel.trim()) {
      onRename(editingId, editLabel);
    }
    setEditingId(null);
    setEditLabel('');
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setEditLabel('');
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const renderScheduleItem = (schedule: Schedule) => (
    <div
      key={schedule.id}
      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: schedule.color }}
        />
        <div className="flex-1 min-w-0">
          {editingId === schedule.id ? (
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              autoFocus
              className="font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-600 border border-blue-500 rounded px-1 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p
              className="font-medium text-gray-800 dark:text-gray-200 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              onClick={() => startEditing(schedule)}
              title="Click to rename"
            >
              {schedule.label}
            </p>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
            {schedule.cronExpression}
            {schedule.durationMinutes > 0 && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({schedule.durationMinutes}min)</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        {onAssignProject && projects.length > 0 && (
          <select
            value={schedule.projectId || ''}
            onChange={(e) => onAssignProject(schedule.id, e.target.value || undefined)}
            className="text-xs px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300"
            title="Assign to project"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => onRemove(schedule.id)}
          className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );

  if (schedules.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Active Schedules</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No schedules added yet. Add your first schedule above.
        </p>
      </div>
    );
  }

  // Group schedules by project if projects exist
  const hasProjects = projects.length > 0;
  const groupedSchedules = hasProjects
    ? (() => {
        const groups: { project: Project | null; schedules: Schedule[] }[] = [];
        const byProject = new Map<string | undefined, Schedule[]>();

        for (const schedule of schedules) {
          const key = schedule.projectId;
          if (!byProject.has(key)) byProject.set(key, []);
          byProject.get(key)!.push(schedule);
        }

        // Add project groups
        for (const project of projects) {
          const projectSchedules = byProject.get(project.id);
          if (projectSchedules) {
            groups.push({ project, schedules: projectSchedules });
          }
        }

        // Add unassigned group
        const unassigned = byProject.get(undefined);
        if (unassigned) {
          groups.push({ project: null, schedules: unassigned });
        }

        return groups;
      })()
    : [{ project: null, schedules }];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
          Active Schedules ({schedules.length})
        </h2>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          aria-label={isCollapsed ? 'Expand schedules' : 'Collapse schedules'}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-4">
          {groupedSchedules.map((group) => (
            <div key={group.project?.id || 'unassigned'}>
              {hasProjects && (
                <div className="flex items-center gap-2 mb-2">
                  {group.project ? (
                    <>
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: group.project.color }}
                      />
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        {group.project.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                      Unassigned
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {group.schedules.map(renderScheduleItem)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
