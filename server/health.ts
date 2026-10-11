import { pool } from './db.js';

export async function checkDatabase() {
  await pool.query('SELECT 1');
}
