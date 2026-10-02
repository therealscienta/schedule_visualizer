import express from 'express';
import cors from 'cors';
import path from 'path';
import { NODE_ENV } from './config';
import { initializeDatabase } from './db/schema';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import schedulesRoutes from './routes/schedules';
import projectsRoutes from './routes/projects';
import sharingRoutes from './routes/sharing';
import adminRoutes from './routes/admin';
import tokensRoutes from './routes/tokens';
import v1Routes from './routes/v1';

// Builds the Express app without listening, so tests can mount it on any port
export function createApp(): express.Express {
  // Initialize database
  initializeDatabase();

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/schedules', schedulesRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/projects', sharingRoutes); // Sharing routes are mounted under /api/projects
  app.use('/api/admin', adminRoutes);
  app.use('/api/tokens', tokensRoutes);
  app.use('/api/v1', v1Routes); // Authenticated with API tokens, unlike the routes above

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve static files in production
  if (NODE_ENV === 'production') {
    const staticPath = path.join(__dirname, '../../dist');
    app.use(express.static(staticPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(staticPath, 'index.html'));
      } else {
        res.status(404).json({ error: 'API endpoint not found' });
      }
    });
  }

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
