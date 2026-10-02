import { HttpError } from '../../errors';
import { findSchedule } from '../../services/schedules';
import { AuthRequest } from '../../types';

export const OUTSIDE_TOKEN_PROJECT = 'This token is limited to one project and cannot use others';

// A token limited to one project only sees and changes that project and its schedules

export function limitedProject(req: AuthRequest): string | null {
  return req.apiToken?.projectId ?? null;
}

// Other projects answer as if they didn't exist
export function assertProjectInScope(req: AuthRequest, projectId: string): void {
  const limit = limitedProject(req);
  if (limit && projectId !== limit) {
    throw new HttpError(404, 'Project not found');
  }
}

// The project to read schedules from: the token's own when it is limited to one
export function projectFilter(req: AuthRequest, requested: string | undefined): string | undefined {
  const limit = limitedProject(req);
  if (limit && requested) {
    assertProjectInScope(req, requested);
  }
  return limit ?? requested;
}

export function assertScheduleInScope(req: AuthRequest, scheduleId: string): void {
  const limit = limitedProject(req);
  if (limit && findSchedule(req.user!.id, scheduleId)?.projectId !== limit) {
    throw new HttpError(404, 'Schedule not found');
  }
}
