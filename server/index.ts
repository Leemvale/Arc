import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { startWorker } from './worker.js';
const app = createApp();
await pool.query('SELECT 1 FROM experiment_budget WHERE id=1');
const stopWorker = startWorker();
await app.listen({ host: '127.0.0.1', port: config.PORT });
console.log(`Arc: http://127.0.0.1:${config.PORT}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    stopWorker();
    void app
      .close()
      .then(() => pool.end())
      .then(() => process.exit(0));
  });
