import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  is_active: number;
  created_at: string;
}

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async (): Promise<void> => {
    try {
      const data = await apiFetch<AdminUser[]>('/admin/users');
      setUsers(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleActive = async (userId: string, currentActive: number): Promise<void> => {
    try {
      await apiFetch(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: currentActive ? 0 : 1 }),
      });
      await loadUsers();
    } catch {
      // Silent
    }
  };

  const toggleRole = async (userId: string, currentRole: string): Promise<void> => {
    try {
      await apiFetch(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: currentRole === 'admin' ? 'user' : 'admin' }),
      });
      await loadUsers();
    } catch {
      // Silent
    }
  };

  const deleteUser = async (userId: string, username: string): Promise<void> => {
    if (!confirm(`Delete user "${username}" and all their data?`)) return;
    try {
      await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
      await loadUsers();
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
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Username</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Created</th>
              <th className="text-left px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                    {u.username}
                    {isSelf && <span className="ml-1 text-xs text-blue-500">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                      u.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {!isSelf && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleRole(u.id, u.role)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          onClick={() => toggleActive(u.id, u.is_active)}
                          className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => deleteUser(u.id, u.username)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
