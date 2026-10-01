// src/components/ImportSchedules.tsx

import { useRef } from 'react';
import type { Schedule, Project } from '../types';

interface ImportSchedulesProps {
  onImport: (data: { schedules: Schedule[]; projects?: Project[] }) => void | Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function toSchedule(item: unknown): Schedule {
  if (
    !isRecord(item) ||
    typeof item.id !== 'string' ||
    typeof item.label !== 'string' ||
    typeof item.cronExpression !== 'string' ||
    typeof item.color !== 'string'
  ) {
    throw new Error('Invalid schedule format');
  }
  // Keep only the known fields; durationMinutes was added later, so default it
  return {
    id: item.id,
    label: item.label,
    cronExpression: item.cronExpression,
    color: item.color,
    durationMinutes: typeof item.durationMinutes === 'number' ? item.durationMinutes : 0,
    projectId: typeof item.projectId === 'string' ? item.projectId : undefined,
  };
}

function toProject(item: unknown): Project {
  if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.color !== 'string') {
    throw new Error('Invalid project format');
  }
  return { id: item.id, name: item.name, color: item.color };
}

export function ImportSchedules({ onImport }: ImportSchedulesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data: unknown = JSON.parse(text);

      // Support both legacy array format and new { schedules, projects } object format
      let schedulesArray: unknown[];
      let projectsArray: unknown[] | undefined;

      if (Array.isArray(data)) {
        schedulesArray = data;
      } else if (isRecord(data) && Array.isArray(data.schedules)) {
        schedulesArray = data.schedules;
        projectsArray = Array.isArray(data.projects) ? data.projects : undefined;
      } else {
        throw new Error('Invalid file format: expected an array of schedules or { schedules, projects }');
      }

      const schedules = schedulesArray.map(toSchedule);
      const projects = projectsArray?.map(toProject);

      await onImport({ schedules, projects });

      alert(`Successfully imported ${schedules.length} schedule(s)${projects ? ` and ${projects.length} project(s)` : ''}`);
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Failed to import schedules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Reset file input so the same file can be picked again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
        id="import-schedules"
      />
      <label
        htmlFor="import-schedules"
        className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Import
      </label>
    </div>
  );
}
