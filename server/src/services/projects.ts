import { v4 as uuidv4 } from 'uuid';
import { getDatabase, isUniqueViolation } from '../db/connection';
import { sqliteToIso } from '../db/time';
import { HttpError } from '../errors';
import { ProjectRole, requireProjectEdit } from './access';

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  role: ProjectRole;
  created_at: string;
  updated_at: string;
}

export interface ApiProject {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
}

function toProject(row: ProjectRow): ApiProject {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    color: row.color,
    role: row.role,
    createdAt: sqliteToIso(row.created_at),
    updatedAt: sqliteToIso(row.updated_at),
  };
}

// Projects the user owns or that are shared with them, with the user's role in each
const PROJECTS_FOR_USER = `
  SELECT p.id, p.owner_id, p.name, p.color, p.created_at, p.updated_at,
         CASE WHEN p.owner_id = :userId THEN 'owner' ELSE ps.permission END AS role
  FROM projects p
  LEFT JOIN project_shares ps ON ps.project_id = p.id AND ps.shared_with_user_id = :userId
  WHERE (p.owner_id = :userId OR ps.id IS NOT NULL)
`;

// Own projects first, newest first within each group
export function listProjects(userId: string): ApiProject[] {
  const rows = getDatabase().prepare(`
    ${PROJECTS_FOR_USER}
    ORDER BY (p.owner_id = :userId) DESC, p.created_at DESC, p.rowid DESC
  `).all({ userId }) as ProjectRow[];
  return rows.map(toProject);
}

// Null when the project doesn't exist or isn't visible to the user
export function findProject(userId: string, projectId: string): ApiProject | null {
  const row = getDatabase().prepare(`${PROJECTS_FOR_USER} AND p.id = :projectId`)
    .get({ userId, projectId }) as ProjectRow | undefined;
  return row ? toProject(row) : null;
}

function getProject(userId: string, projectId: string): ApiProject {
  const project = findProject(userId, projectId);
  if (!project) {
    throw new HttpError(404, 'Project not found');
  }
  return project;
}

export function createProject(userId: string, input: { id?: string; name: string; color: string }): ApiProject {
  const id = input.id || uuidv4();
  try {
    getDatabase().prepare(`
      INSERT INTO projects (id, owner_id, name, color)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, input.name, input.color);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'A project with this id already exists');
    }
    throw err;
  }
  return getProject(userId, id);
}

export function updateProject(userId: string, projectId: string, updates: { name?: string; color?: string }): ApiProject {
  requireProjectEdit(userId, projectId, 'No permission to update this project');

  const fields: string[] = [];
  const values: string[] = [];
  if (updates.name) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.color) {
    fields.push('color = ?');
    values.push(updates.color);
  }
  if (fields.length === 0) {
    throw new HttpError(400, 'No fields to update');
  }

  fields.push("updated_at = datetime('now')");
  getDatabase().prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values, projectId);
  return getProject(userId, projectId);
}

export function deleteProject(userId: string, projectId: string): void {
  const project = getDatabase().prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as
    | { owner_id: string }
    | undefined;
  if (!project) {
    throw new HttpError(404, 'Project not found');
  }
  if (project.owner_id !== userId) {
    throw new HttpError(403, 'Only the owner can delete this project');
  }
  getDatabase().prepare('DELETE FROM projects WHERE id = ?').run(projectId);
}
