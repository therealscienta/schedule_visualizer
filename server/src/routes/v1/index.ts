import { Router, Response } from 'express';
import { apiTokenMiddleware } from '../../middleware/apiToken';
import { openApiDocument } from '../../openapi';
import { AuthRequest } from '../../types';
import { registerProjectRoutes } from './projects';
import { registerScheduleRoutes } from './schedules';
import { registerSyncRoutes } from './sync';
import { registerTimelineRoutes } from './timeline';

// The API for scripts, authenticated with API tokens only (the web app's login tokens are
// rejected here, and API tokens are rejected by the routes under /api). Every route sits on
// this one router, which is what the OpenAPI test walks through.
//
// The handlers are synchronous, so Express passes anything they throw (HttpError included)
// to the error handler.
const router = Router();

router.get('/openapi.json', (_req, res: Response) => {
  res.json(openApiDocument);
});

router.use(apiTokenMiddleware);

router.get('/me', (req: AuthRequest, res: Response) => {
  const { id, username, email } = req.user!;
  res.json({ user: { id, username, email }, token: req.apiToken });
});

registerProjectRoutes(router);
registerScheduleRoutes(router);
registerSyncRoutes(router);
registerTimelineRoutes(router);

router.use((_req, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

export default router;
