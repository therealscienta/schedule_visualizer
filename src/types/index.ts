// src/types/index.ts

export type ProjectRole = 'owner' | 'view' | 'edit';

export interface Project {
  id: string;
  name: string;
  color: string;
  role?: ProjectRole; // Set for projects loaded from the server
}

export interface Schedule {
  id: string;
  label: string;
  cronExpression: string;
  color: string;
  durationMinutes: number;
  projectId?: string;
  ownerId?: string; // Set for schedules loaded from the server
  syncKey?: string; // Set for schedules a script manages through the API
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
  role: ProjectRole;
}

export interface ServerSchedule {
  id: string;
  ownerId: string;
  projectId: string | null;
  label: string;
  cronExpression: string;
  color: string;
  durationMinutes: number;
  syncKey: string | null;
  createdAt: string;
  updatedAt: string;
}

// An API token as listed; the token itself is only shown when it is created
export interface ApiToken {
  id: string;
  name: string;
  prefix: string; // The first characters of the token, to tell tokens apart
  scope: 'read' | 'write';
  projectId: string | null; // Set when the token is limited to one project
  projectName: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expired: boolean;
}
