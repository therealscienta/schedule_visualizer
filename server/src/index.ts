import express from 'express';
import cors from 'cors';
import path from 'path';
import { PORT, NODE_ENV } from './config';
import { initializeDatabase } from './db/schema';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import schedulesRoutes from './routes/schedules';
import projectsRoutes from './routes/projects';
import sharingRoutes from './routes/sharing';
import adminRoutes from './routes/admin';

// Initialize database
initializeDatabase();

// Create Express app
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});
