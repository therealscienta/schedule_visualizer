import type { TimeFormat } from '../types';

export function formatTimestamp(date: Date, timeFormat: TimeFormat): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  });
}
