import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  AppError,
  startSession,
  sessionView,
  submitAnswer,
  retryAnswer,
  advanceSession,
} from '../sessions.js';

export function registerSessionRoutes(app: FastifyInstance) {
  app.post('/api/sessions', async () => ({ id: await startSession() }));
  const idFrom = (params: unknown) => z.strictObject({ id: z.uuid() }).parse(params).id;
  app.get('/api/sessions/:id', async (request) => sessionView(idFrom(request.params)));
  app.post('/api/sessions/:id/answers', async (request, reply) => {
    const { exerciseId, value } = z
      .strictObject({ exerciseId: z.string(), value: z.string().max(8000) })

      .parse(request.body);
    const id = idFrom(request.params);
    await submitAnswer(id, exerciseId, value);
    return reply.code(202).send(await sessionView(id));
  });
  app.post('/api/answers/:id/retry', async (request) =>
    sessionView(await retryAnswer(idFrom(request.params))),
  );
  app.post('/api/sessions/:id/advance', async (request) => {
    const { revision, exerciseId } = z
      .strictObject({ revision: z.number().int(), exerciseId: z.string() })

      .parse(request.body);
    const id = idFrom(request.params);
    await advanceSession(id, revision, exerciseId);
    return sessionView(id);
  });
  app.get('/api/sessions/:id/result', async (request) => {
    const session = await sessionView(idFrom(request.params));
    if (session.status !== 'completed') throw new AppError(409, 'Сессия ещё не завершена');
    return session;
  });
}
