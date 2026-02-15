// src/components/ProjectManager.tsx

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShareProjectModal } from './ShareProjectModal';
import type { Project } from '../types';

interface ProjectManagerProps {
  projects: Project[];
  onAdd: (name: string, color: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

const PROJECT_COLORS = [
  '#6366F1', '#EC4899', '#14B8A6', '#F97316',
  '#8B5CF6', '#EF4444', '#10B981', '#F59E0B',
];

export function ProjectManager({ projects, onAdd, onRemove, onRename }: ProjectManagerProps) {
  const { isAuthenticated } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [sharingProject, setSharingProject] = useState<Project | null>(null);

  const handleAdd = (): void => {
    if (!newName.trim()) return;
    onAdd(newName.trim(), selectedColor);
    setNewName('');
    setSelectedColor(PROJECT_COLORS[(projects.length + 1) % PROJECT_COLORS.length]);
    setIsAdding(false);
  };

  const startEditing = (project: Project): void => {
    setEditingId(project.id);
    setEditName(project.name);
  };

  const saveEdit = (): void => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: 'add' | 'edit'): void => {
    if (e.key === 'Enter') {
      action === 'add' ? handleAdd() : saveEdit();
    } else if (e.key === 'Escape') {
      if (action === 'add') {
        setIsAdding(false);
        setNewName('');
      } else {
        setEditingId(null);
        setEditName('');
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Projects</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {isAdding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {isAdding && (
        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'add')}
            placeholder="Project name"
            autoFocus
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-1 mt-2">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-5 h-5 rounded-full border-2 ${
                  selectedColor === color ? 'border-gray-800 dark:border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button
            onClick={handleAdd}
            className="mt-2 w-full text-xs bg-blue-600 text-white py-1 rounded hover:bg-blue-700 transition-colors"
          >
            Create Project
          </button>
        </div>
      )}

      {projects.length === 0 && !isAdding && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
          No projects yet
        </p>
      )}

      <div className="space-y-1">
        {projects.map((project) => (
          <div
            key={project.id}
            className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 group"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              {editingId === project.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'edit')}
                  onBlur={saveEdit}
                  autoFocus
                  className="text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-600 border border-blue-500 rounded px-1 py-0.5 w-full focus:outline-none"
                />
              ) : (
                <span
                  className="text-xs text-gray-700 dark:text-gray-300 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onClick={() => startEditing(project)}
                  title="Click to rename"
                >
                  {project.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
              {isAuthenticated && (
                <button
                  onClick={() => setSharingProject(project)}
                  className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
                  title="Share project"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => onRemove(project.id)}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>

      {sharingProject && (
        <ShareProjectModal
          isOpen={true}
          onClose={() => setSharingProject(null)}
          projectId={sharingProject.id}
          projectName={sharingProject.name}
        />
      )}
    </div>
  );
}
