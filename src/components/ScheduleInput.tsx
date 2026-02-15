// src/components/ScheduleInput.tsx

import { useState } from 'react';
import { validateCronExpression } from '../utils/cronParser';
import type { Project } from '../types';

interface ScheduleInputProps {
  onAdd: (label: string, cronExpression: string, durationMinutes: number, projectId?: string) => void;
  projects?: Project[];
}

export function ScheduleInput({ onAdd, projects = [] }: ScheduleInputProps) {
  const [label, setLabel] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!label.trim()) {
      setError('Please enter a label');
      return;
    }

    if (!cronExpression.trim()) {
      setError('Please enter a cron expression');
      return;
    }

    if (!validateCronExpression(cronExpression)) {
      setError('Invalid cron expression. Use standard 5-field format: minute hour day month weekday');
      return;
    }

    onAdd(label, cronExpression, durationMinutes, selectedProjectId || undefined);
    setLabel('');
    setCronExpression('');
    setDurationMinutes(0);
    setSelectedProjectId('');
    setError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Add New Schedule</h2>

      <div className="mb-4">
        <label htmlFor="label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Label
        </label>
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError(null);
          }}
          placeholder="e.g., Daily Backup"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="cron" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Cron Expression
        </label>
        <input
          id="cron"
          type="text"
          value={cronExpression}
          onChange={(e) => {
            setCronExpression(e.target.value);
            setError(null);
          }}
          placeholder="e.g., 0 2 * * *"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono dark:bg-gray-700 dark:text-gray-200"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Format: minute hour day-of-month month day-of-week
        </p>
      </div>

      <div className="mb-4">
        <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Duration (minutes)
        </label>
        <input
          id="duration"
          type="number"
          value={durationMinutes}
          onChange={(e) => {
            setDurationMinutes(Math.max(0, Math.min(1440, parseInt(e.target.value) || 0)));
            setError(null);
          }}
          min={0}
          max={1440}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          0 = point-in-time event, max 1440 (24 hours)
        </p>
      </div>

      {projects.length > 0 && (
        <div className="mb-4">
          <label htmlFor="project" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Project
          </label>
          <select
            id="project"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
      >
        Add Schedule
      </button>

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Common Examples:</p>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">0 * * * *</code> - Every hour</li>
          <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">*/15 * * * *</code> - Every 15 minutes</li>
          <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">0 2 * * *</code> - Daily at 2:00 AM</li>
          <li><code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">0 0 * * 0</code> - Weekly on Sunday</li>
        </ul>
      </div>
    </form>
  );
}
