// src/components/ProjectFilter.tsx

import type { Project } from '../types';

interface ProjectFilterProps {
  projects: Project[];
  selectedFilter: string | null;
  onFilterChange: (projectId: string | null) => void;
}

export function ProjectFilter({ projects, selectedFilter, onFilterChange }: ProjectFilterProps) {
  if (projects.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onFilterChange(null)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          selectedFilter === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
        }`}
      >
        All
      </button>
      {projects.map((project) => (
        <button
          key={project.id}
          onClick={() => onFilterChange(project.id)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedFilter === project.id
              ? 'text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
          }`}
          style={selectedFilter === project.id ? { backgroundColor: project.color } : undefined}
        >
          {project.name}
        </button>
      ))}
      <button
        onClick={() => onFilterChange('unassigned')}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          selectedFilter === 'unassigned'
            ? 'bg-gray-600 text-white dark:bg-gray-400 dark:text-gray-900'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
        }`}
      >
        Unassigned
      </button>
    </div>
  );
}
