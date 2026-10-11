import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export function registerSecurity(app: FastifyInstance) {
  const allowedHosts = new Set([
    `127.0.0.1:${config.PORT}`,
    `localhost:${config.PORT}`,
    '127.0.0.1:5173',
    'localhost:5173',
  ]);
  const origins = new Set([...allowedHosts].map((host) => `http://${host}`));
  app.addHook('onRequest', async (request, reply) => {
    if (!allowedHosts.has(request.headers.host ?? ''))
      return reply.code(403).send({ message: 'Недопустимый Host' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (
        !origins.has(request.headers.origin ?? '') ||
        !request.headers['content-type']?.startsWith('application/json')
      )
        return reply.code(403).send({ message: 'Запрос разрешён только из локального приложения' });
    }
  });
}
