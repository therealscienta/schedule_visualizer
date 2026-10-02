import { Router, Response } from 'express';
import { z } from 'zod';
import { parse } from '../errors';
import { authMiddleware } from '../middleware/auth';
import { createApiToken, listApiTokens, revokeApiToken } from '../services/apiTokens';
import { AuthRequest } from '../types';

const router = Router();

// Tokens are managed with a login session only, so a leaked token can't create more of them
router.use(authMiddleware);

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scope: z.enum(['read', 'write']),
  projectId: z.string().min(1).nullable().optional(),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(), // Omitted or null: never expires
});

// GET / - List the user's tokens (never the tokens themselves)
router.get('/', (req: AuthRequest, res: Response) => {
  res.json(listApiTokens(req.user!.id));
});

// POST / - Create a token; the response is the only time it is shown
router.post('/', (req: AuthRequest, res: Response) => {
  const input = parse(createTokenSchema, req.body);
  const { token, summary } = createApiToken(req.user!.id, input);
  res.status(201).json({ ...summary, token });
});

// DELETE /:id - Revoke a token
router.delete('/:id', (req: AuthRequest, res: Response) => {
  revokeApiToken(req.user!.id, req.params.id);
  res.status(204).send();
});

export default router;
