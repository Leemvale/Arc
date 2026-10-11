import type { PoolClient } from 'pg';
import { config } from './config.js';
import { MAX_INPUT, MAX_OUTPUT } from './assessor.js';
export const maxCost = () =>
  (MAX_INPUT * config.OPENAI_INPUT_PRICE + MAX_OUTPUT * config.OPENAI_OUTPUT_PRICE) / 1e6;
export function actualCost(input: number, output: number) {
  return (input * config.OPENAI_INPUT_PRICE + output * config.OPENAI_OUTPUT_PRICE) / 1e6;
}
export async function reserve(db: PoolClient, id: string) {
  const amount = maxCost();
  const result = await db.query(
    'UPDATE experiment_budget SET reserved=reserved+$1 WHERE id=1 AND spent+reserved+$1<=limit_usd RETURNING id',
    [amount],
  );
  if (!result.rowCount)
    throw new Error(
      'Лимит расходов API исчерпан. Ответ сохранён; новая платная проверка не начата.',
    );
  await db.query('UPDATE assessment_attempts SET reserve=$2 WHERE id=$1', [id, amount]);
}
export async function settle(
  db: PoolClient,
  attempt: { id: string; reserve: string | number },
  cost?: number,
) {
  const charged = cost ?? Number(attempt.reserve);
  await db.query(
    'UPDATE experiment_budget SET reserved=GREATEST(0,reserved-$1),spent=spent+$2 WHERE id=1',
    [attempt.reserve, charged],
  );
  await db.query('UPDATE assessment_attempts SET cost=$2 WHERE id=$1', [attempt.id, charged]);
}
