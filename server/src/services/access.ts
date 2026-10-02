import { getDatabase } from '../db/connection';
import { HttpError } from '../errors';

export type ProjectRole = 'owner' | 'edit' | 'view';

// The user's role in a project, or null when the project doesn't exist or isn't shared with them
export function getProjectRole(userId: string, projectId: string): ProjectRole | null {
  const row = getDatabase().prepare(`
    SELECT CASE WHEN p.owner_id = ? THEN 'owner' ELSE ps.permission END AS role
    FROM projects p
    LEFT JOIN project_shares ps ON ps.project_id = p.id AND ps.shared_with_user_id = ?
    WHERE p.id = ?
  `).get(userId, userId, projectId) as { role: ProjectRole | null } | undefined;
  return row?.role ?? null;
}

export function canEdit(role: ProjectRole | null): boolean {
  return role === 'owner' || role === 'edit';
}

// Unknown projects are a 404 (not a 403) so clients can tell "create it" from "not allowed"
export function requireProjectEdit(userId: string, projectId: string, forbiddenMessage: string): ProjectRole {
  const role = getProjectRole(userId, projectId);
  if (role === 'owner' || role === 'edit') {
    return role;
  }
  const exists = getDatabase().prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!exists) {
    throw new HttpError(404, 'Project not found');
  }
  throw new HttpError(403, forbiddenMessage);
}
