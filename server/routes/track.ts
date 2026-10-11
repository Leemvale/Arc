import type { FastifyInstance } from 'fastify';
import { getTrack } from '../track.js';

export function registerTrackRoutes(app: FastifyInstance) {
  app.get('/api/track', getTrack);
}
