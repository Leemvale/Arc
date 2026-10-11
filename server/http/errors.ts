import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../sessions.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({ message: 'Проверьте поля запроса' });
    if (error instanceof AppError)
      return reply.code(error.statusCode).send({ message: error.message });
    return reply.code(503).send({
      message:
        'Не удалось выполнить запрос. Проверьте подключение к базе; введённый ответ остаётся в форме.',
    });
  });
}
