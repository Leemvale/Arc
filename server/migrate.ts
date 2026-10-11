import { pool, transaction } from './db.js';
import { migration } from './schema.js';
import { config } from './config.js';
try {
  await transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(401001)');
    await db.query(migration);
    await db.query(
      'INSERT INTO experiment_budget(id,limit_usd) VALUES(1,$1) ON CONFLICT DO NOTHING',
      [config.EXPERIMENT_BUDGET_USD],
    );
  });
  console.log('Миграции применены. Существующие данные и бюджет сохранены.');
} finally {
  await pool.end();
}
