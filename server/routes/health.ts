import type { FastifyInstance } from 'fastify';
import { checkDatabase } from '../health.js';

export function registerHealthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    await checkDatabase();
    return { ok: true };
  });
}
