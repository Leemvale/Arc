import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migration } from '../server/schema.js';
const schema = `arc_browser_${randomUUID().replaceAll('-', '')}`;
const url = new URL(
  process.env.DATABASE_URL ?? 'postgres://arc:arc-local-only@127.0.0.1:54329/arc',
);
const admin = new pg.Pool({ connectionString: url.toString() });
await admin.query(`CREATE SCHEMA ${schema}`);
url.searchParams.set('options', `-csearch_path=${schema}`);
process.env.DATABASE_URL = url.toString();
process.env.PORT = '3002';
const { pool } = await import('../server/db.js');
const { createApp } = await import('../server/app.js');
const { runOne } = await import('../server/worker.js');
await pool.query(migration);
await pool.query('INSERT INTO experiment_budget(id,limit_usd) VALUES(1,5)');
const app = createApp();
let failNext = false;
app.post('/__test/fail-next', async () => {
  failNext = true;
  return { ok: true };
});
let busy = false;
const timer = setInterval(() => {
  if (busy) return;
  busy = true;
  void runOne(
    async (e) => {
      await new Promise((r) => setTimeout(r, 1500));
      if (failNext) {
        failNext = false;
        throw Error('simulated provider error');
      }
      return {
        result: {
          criteria: e.criteria.map((c) => ({
            criterionId: c.id,
            met: true,
            explanation: c.description,
          })),
          understood: ['Тестовый ответ'],
          missingOrIncorrect: [],
          explanation: 'Тестовая оценка для проверки интерфейса, не результат AI.',
          sourceIds: e.sourceIds,
        },
        inputTokens: 100,
        outputTokens: 100,
      };
    },
    () => {},
  ).finally(() => {
    busy = false;
  });
}, 100);
await app.listen({ host: '127.0.0.1', port: 3002 });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await app.close();
  while (busy) await new Promise((r) => setTimeout(r, 100));
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
  process.exit(0);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
