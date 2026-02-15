// src/components/StatisticsPanel.tsx

import { useMemo } from 'react';
import type { ScheduleExecution, OverlapExecution } from '../types';
import { useSettings } from '../contexts/SettingsContext';

interface StatisticsPanelProps {
  executions: ScheduleExecution[];
  overlaps: OverlapExecution[];
  startDate: Date;
  endDate: Date;
}

interface HourStat {
  hour: number;
  count: number;
}

interface DayStat {
  date: string;
  count: number;
}

export function StatisticsPanel({ executions, overlaps, startDate, endDate }: StatisticsPanelProps) {
  const { timeFormat } = useSettings();

  const stats = useMemo(() => {
    // Calculate total executions
    const totalExecutions = executions.length;

    // Calculate executions by hour of day
    const hourCounts = new Map<number, number>();
    for (const exec of executions) {
      const hour = exec.timestamp.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // Find busiest hour
    let busiestHour = 0;
    let maxCount = 0;
    for (const [hour, count] of hourCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        busiestHour = hour;
      }
    }

    // Calculate executions by day
    const dayCounts = new Map<string, number>();
    for (const exec of executions) {
      const dateKey = exec.timestamp.toISOString().split('T')[0];
      dayCounts.set(dateKey, (dayCounts.get(dateKey) || 0) + 1);
    }

    // Find busiest day
    let busiestDay = '';
    let maxDayCount = 0;
    for (const [day, count] of dayCounts.entries()) {
      if (count > maxDayCount) {
        maxDayCount = count;
        busiestDay = day;
      }
    }

    // Calculate average executions per day
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgPerDay = durationDays > 0 ? (totalExecutions / durationDays).toFixed(1) : '0';

    // Top 5 busiest hours
    const topHours: HourStat[] = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top 5 busiest days
    const topDays: DayStat[] = Array.from(dayCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate total overlap duration
    let totalOverlapDurationMs = 0;
    for (const overlap of overlaps) {
      totalOverlapDurationMs += overlap.endTimestamp.getTime() - overlap.startTimestamp.getTime();
    }
    const totalOverlapDurationMinutes = Math.round(totalOverlapDurationMs / (1000 * 60));

    return {
      totalExecutions,
      totalOverlaps: overlaps.length,
      totalOverlapDurationMinutes,
      busiestHour,
      busiestHourCount: maxCount,
      busiestDay,
      busiestDayCount: maxDayCount,
      avgPerDay,
      topHours,
      topDays,
    };
  }, [executions, overlaps, startDate, endDate]);

  const formatHour = (hour: number): string => {
    if (timeFormat === '24h') {
      return `${hour.toString().padStart(2, '0')}:00`;
    }
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return '0m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (executions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Statistics</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
          <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-400 mb-1">Total Executions</div>
          <div className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-300">{stats.totalExecutions}</div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 sm:p-4 border border-green-200 dark:border-green-800">
          <div className="text-xs sm:text-sm text-green-700 dark:text-green-400 mb-1">Avg. Per Day</div>
          <div className="text-xl sm:text-2xl font-bold text-green-900 dark:text-green-300">{stats.avgPerDay}</div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 sm:p-4 border border-purple-200 dark:border-purple-800">
          <div className="text-xs sm:text-sm text-purple-700 dark:text-purple-400 mb-1">Busiest Hour</div>
          <div className="text-lg sm:text-2xl font-bold text-purple-900 dark:text-purple-300">
            {formatHour(stats.busiestHour)}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400">{stats.busiestHourCount} exec.</div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 sm:p-4 border border-red-200 dark:border-red-800">
          <div className="text-xs sm:text-sm text-red-700 dark:text-red-400 mb-1">Total Overlaps</div>
          <div className="text-xl sm:text-2xl font-bold text-red-900 dark:text-red-300">{stats.totalOverlaps}</div>
          {stats.totalOverlapDurationMinutes > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400">{formatDuration(stats.totalOverlapDurationMinutes)} duration</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Top 5 Busiest Hours</h3>
          <div className="space-y-2">
            {stats.topHours.map((hourStat, idx) => (
              <div
                key={hourStat.hour}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">#{idx + 1}</span>
                  {formatHour(hourStat.hour)}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {hourStat.count} executions
                </span>
              </div>
            ))}
            {stats.topHours.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No data available</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Top 5 Busiest Days</h3>
          <div className="space-y-2">
            {stats.topDays.map((dayStat, idx) => (
              <div
                key={dayStat.date}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">#{idx + 1}</span>
                  {formatDate(dayStat.date)}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {dayStat.count} executions
                </span>
              </div>
            ))}
            {stats.topDays.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
