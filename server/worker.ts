import { transaction } from './db.js';
import { openAI, providerReady, preparePrompt, PROMPT_VERSION, type Assessor } from './assessor.js';
import { reserve, settle, actualCost } from './budget.js';
import { config } from './config.js';
import { saveAssessment } from './sessions.js';
import { validateAssessment, type Track } from '../shared/domain.js';

export async function recoverExpired() {
  await transaction(async (db) => {
    const { rows } = await db.query(
      "SELECT * FROM assessment_attempts WHERE state='running' AND deadline<now() FOR UPDATE SKIP LOCKED",
    );
    for (const attempt of rows) {
      await settle(db, attempt);
      await db.query(
        "UPDATE assessment_attempts SET state='failed',error='Проверка прервана' WHERE id=$1",
        [attempt.id],
      );
      await db.query(
        "UPDATE answers SET state='failed',error='Проверка прервана. Ответ сохранён; можно повторить проверку.' WHERE attempt_id=$1 AND state!='assessed'",
        [attempt.id],
      );
    }
  });
}
export async function runOne(assessor: Assessor = openAI, ready = providerReady) {
  await recoverExpired();
  const job = await transaction(async (db) => {
    const { rows } = await db.query(
      "SELECT p.*,a.value,a.exercise_id,s.snapshot FROM assessment_attempts p JOIN answers a ON a.id=p.answer_id JOIN sessions s ON s.id=a.session_id WHERE p.state='queued' ORDER BY p.created_at LIMIT 1 FOR UPDATE OF p SKIP LOCKED",
    );
    const attempt = rows[0];
    if (!attempt) return null;
    const snapshot = attempt.snapshot as Track;
    const exercise = snapshot.exercises.find((e) => e.id === attempt.exercise_id)!;
    try {
      ready();
      preparePrompt(exercise, snapshot, attempt.value);
      await reserve(db, attempt.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Проверка недоступна';
      await db.query("UPDATE assessment_attempts SET state='failed',error=$2 WHERE id=$1", [
        attempt.id,
        message,
      ]);
      await db.query("UPDATE answers SET state='failed',error=$2 WHERE attempt_id=$1", [
        attempt.id,
        message,
      ]);
      return null;
    }
    await db.query(
      "UPDATE assessment_attempts SET state='running',deadline=now()+interval '90 seconds',model=$2,prompt_version=$3,rubric_version=$4 WHERE id=$1",
      [attempt.id, config.OPENAI_MODEL, PROMPT_VERSION, snapshot.version],
    );
    await db.query("UPDATE answers SET state='evaluating' WHERE attempt_id=$1", [attempt.id]);
    return { ...attempt, snapshot, exercise };
  });
  if (!job) return false;
  let outcome: Awaited<ReturnType<Assessor>>;
  try {
    outcome = await assessor(job.exercise, job.snapshot, job.value);
    outcome.result = validateAssessment(outcome.result, job.exercise);
  } catch {
    await transaction(async (db) => {
      const { rows } = await db.query(
        "SELECT * FROM assessment_attempts WHERE id=$1 AND state='running' FOR UPDATE",
        [job.id],
      );
      if (!rows[0]) return;
      await settle(db, rows[0]);
      await db.query(
        "UPDATE assessment_attempts SET state='failed',error='Ошибка провайдера или невалидная оценка' WHERE id=$1",
        [job.id],
      );
      await db.query(
        "UPDATE answers SET state='failed',error='Не удалось получить корректную оценку. Ответ сохранён; повторите проверку.' WHERE attempt_id=$1",
        [job.id],
      );
    });
    return true;
  }
  // If this transaction fails, retain reservation until deadline recovery; never mark learning failure.
  await transaction(async (db) => {
    const { rows } = await db.query(
      "SELECT * FROM assessment_attempts WHERE id=$1 AND state='running' AND deadline>now() FOR UPDATE",
      [job.id],
    );
    if (!rows[0]) return;
    const answer = await db.query('SELECT attempt_id FROM answers WHERE id=$1 FOR UPDATE', [
      job.answer_id,
    ]);
    if (answer.rows[0]?.attempt_id !== job.id) return;
    await saveAssessment(db, job.answer_id, outcome.result);
    await settle(db, rows[0], actualCost(outcome.inputTokens, outcome.outputTokens));
    await db.query(
      "UPDATE assessment_attempts SET state='completed',input_tokens=$2,output_tokens=$3 WHERE id=$1",
      [job.id, outcome.inputTokens, outcome.outputTokens],
    );
  });
  return true;
}
export function startWorker() {
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    void runOne()
      .catch(() =>
        console.error(
          'Не удалось сохранить состояние проверки; восстановление произойдёт по deadline.',
        ),
      )
      .finally(() => {
        busy = false;
      });
  }, 700);
  return () => clearInterval(timer);
}
