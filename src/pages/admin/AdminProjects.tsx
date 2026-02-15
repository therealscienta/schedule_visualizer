import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

interface AdminProject {
  id: string;
  name: string;
  color: string;
  ownerUsername: string;
  scheduleCount: number;
  shareCount: number;
  createdAt: string;
}

export function AdminProjects() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async (): Promise<void> => {
    try {
      const data = await apiFetch<AdminProject[]>('/admin/projects');
      setProjects(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const deleteProject = async (id: string, name: string): Promise<void> => {
    if (!confirm(`Delete project "${name}" and all its data?`)) return;
    try {
      await apiFetch(`/admin/projects/${id}`, { method: 'DELETE' });
      await loadProjects();
    } catch {
      // Silent
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Project</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Owner</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Schedules</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Shares</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Created</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.ownerUsername}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.scheduleCount}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.shareCount}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => deleteProject(p.id, p.name)}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {projects.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No projects found.
        </div>
      )}
    </div>
  );
}
