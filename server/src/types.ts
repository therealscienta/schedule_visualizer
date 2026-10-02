import { Request } from 'express';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

export type TokenScope = 'read' | 'write';

// The API token a /api/v1 request was made with
export interface ApiTokenInfo {
  id: string;
  name: string;
  scope: TokenScope;
  projectId: string | null; // Set when the token is limited to one project
  expiresAt: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  apiToken?: ApiTokenInfo;
}
