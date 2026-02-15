// src/components/ImportSchedules.tsx

import { useRef } from 'react';
import type { Schedule, Project } from '../types';

interface ImportSchedulesProps {
  onImport: (data: { schedules: Schedule[]; projects?: Project[] }) => void;
}

export function ImportSchedules({ onImport }: ImportSchedulesProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Support both legacy array format and new { schedules, projects } object format
      let schedulesArray: any[];
      let projectsArray: any[] | undefined;

      if (Array.isArray(data)) {
        schedulesArray = data;
      } else if (data && typeof data === 'object' && Array.isArray(data.schedules)) {
        schedulesArray = data.schedules;
        projectsArray = Array.isArray(data.projects) ? data.projects : undefined;
      } else {
        throw new Error('Invalid file format: expected an array of schedules or { schedules, projects }');
      }

      // Validate each schedule has required fields
      const isValid = schedulesArray.every(
        (item: any) =>
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.label === 'string' &&
          typeof item.cronExpression === 'string' &&
          typeof item.color === 'string'
      );

      if (!isValid) {
        throw new Error('Invalid schedule format');
      }

      // Migration: add durationMinutes if missing
      const migrated = schedulesArray.map((s: any) => ({
        ...s,
        durationMinutes: s.durationMinutes ?? 0,
      }));

      onImport({ schedules: migrated, projects: projectsArray });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      alert(`Successfully imported ${schedulesArray.length} schedule(s)${projectsArray ? ` and ${projectsArray.length} project(s)` : ''}`);
    } catch (error) {
      console.error('Import failed:', error);
      alert(`Failed to import schedules: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
