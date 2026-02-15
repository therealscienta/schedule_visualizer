// src/types/index.ts

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface Schedule {
  id: string;
  label: string;
  cronExpression: string;
  color: string;
  durationMinutes: number;
  projectId?: string;
}

export interface ScheduleExecution {
  scheduleId: string;
  timestamp: Date;
  endTimestamp: Date;
  label: string;
  color: string;
}

export interface OverlapExecution {
  startTimestamp: Date;
  endTimestamp: Date;
  scheduleIds: string[];
  count: number;
}

export type TimeFormat = '12h' | '24h';

export type TimeRange = '24h' | '7d' | '30d' | 'custom';

export type TimelineMode = 'multi' | 'single';

export interface TimeRangeConfig {
  label: string;
  hours: number;
}

export const TIME_RANGE_CONFIGS: Record<TimeRange, TimeRangeConfig> = {
  '24h': { label: '24 Hours', hours: 24 },
  '7d': { label: '7 Days', hours: 168 },
  '30d': { label: '30 Days', hours: 720 },
  'custom': { label: 'Custom', hours: 24 },
};

export interface CustomDateRange {
  startDate: Date;
  endDate: Date;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

export interface ProjectShare {
  id: string;
  projectId: string;
  sharedWithUserId: string;
  sharedWithUsername: string;
  permission: 'view' | 'edit';
}

export interface ServerProject extends Project {
  role: 'owner' | 'view' | 'edit';
}

export interface ServerSchedule {
  id: string;
  ownerId: string;
  projectId: string | null;
  label: string;
  cronExpression: string;
  color: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
}
