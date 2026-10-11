import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function registerStaticFiles(app: FastifyInstance) {
  if (existsSync(resolve('dist/index.html'))) {
    app.register(fastifyStatic, { root: resolve('dist'), wildcard: false });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.code(404).send({ message: 'Маршрут не найден' })
        : reply.sendFile('index.html'),
    );
  }
}
