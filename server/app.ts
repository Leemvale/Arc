import Fastify from 'fastify';
import { registerSecurity } from './http/security.js';
import { registerErrorHandler } from './http/errors.js';
import { registerStaticFiles } from './http/static.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerTrackRoutes } from './routes/track.js';
import { registerSessionRoutes } from './routes/sessions.js';

export function createApp() {
  const app = Fastify({ bodyLimit: 64000 });
  registerSecurity(app);
  registerErrorHandler(app);
  registerHealthRoutes(app);
  registerTrackRoutes(app);
  registerSessionRoutes(app);
  registerStaticFiles(app);
  return app;
}
