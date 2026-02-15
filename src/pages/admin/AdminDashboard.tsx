import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

interface Stats {
  userCount: number;
  projectCount: number;
  scheduleCount: number;
  shareCount: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch<Stats>('/admin/stats').then(setStats).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  const cards = [
    { label: 'Total Users', value: stats.userCount, color: 'bg-blue-500' },
    { label: 'Total Projects', value: stats.projectCount, color: 'bg-green-500' },
    { label: 'Total Schedules', value: stats.scheduleCount, color: 'bg-purple-500' },
    { label: 'Total Shares', value: stats.shareCount, color: 'bg-orange-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center mb-3`}>
            <span className="text-white text-lg font-bold">{card.value}</span>
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
