import { PORT, NODE_ENV } from './config';
import { createApp } from './app';

// Create Express app
const app = createApp();

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
});
