import { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '../utils/api';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

interface ShareEntry {
  id: string;
  userId: string;
  username: string;
  email: string;
  permission: 'view' | 'edit';
}

export function ShareProjectModal({ isOpen, onClose, projectId, projectName }: ShareProjectModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadShares = useCallback(async () => {
    try {
      const data = await apiFetch<ShareEntry[]>(`/projects/${projectId}/shared-users`);
      setShares(data);
    } catch {
      // Silent
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      loadShares();
      setIdentifier('');
      setError('');
    }
  }, [isOpen, loadShares]);

  const handleShare = async (): Promise<void> => {
    if (!identifier.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      await apiFetch(`/projects/${projectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), permission }),
      });
      setIdentifier('');
      await loadShares();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to share');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (userId: string): Promise<void> => {
    try {
      await apiFetch(`/projects/${projectId}/share/${userId}`, { method: 'DELETE' });
      await loadShares();
    } catch {
      // Silent
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Share "{projectName}"
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              placeholder="Username or email"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
              className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="view">View</option>
              <option value="edit">Edit</option>
            </select>
            <button
              onClick={handleShare}
              disabled={isSubmitting || !identifier.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Share
            </button>
          </div>

          {shares.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Shared with
              </h4>
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {share.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {share.email} - {share.permission}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(share.userId)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
