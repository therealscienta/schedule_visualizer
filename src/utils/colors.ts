// src/utils/colors.ts

export const SCHEDULE_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#84CC16', // lime
] as const;

export function getColorForIndex(index: number): string {
  return SCHEDULE_COLORS[((index % SCHEDULE_COLORS.length) + SCHEDULE_COLORS.length) % SCHEDULE_COLORS.length];
}
