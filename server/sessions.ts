import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { preparePrompt } from './assessor.js';
import { track } from '../content/track.js';
import {
  assessChoice,
  category,
  publicExercise,
  type Assessment,
  type SessionView,
  type Track,
} from '../shared/domain.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
async function lockedSession(db: PoolClient, id: string) {
  const { rows } = await db.query('SELECT * FROM sessions WHERE id=$1 FOR UPDATE', [id]);
  if (!rows[0]) throw new AppError(404, 'Сессия не найдена');
  return rows[0] as {
    id: string;
    status: string;
    position: number;
    revision: number;
    snapshot: Track;
  };
}
export async function startSession() {
  return transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(401002)');
    const existing = await db.query(
      "SELECT id FROM sessions WHERE track_id=$1 AND status='active'",
      [track.id],
    );
    if (existing.rows[0]) return existing.rows[0].id as string;
    const id = randomUUID();
    await db.query('INSERT INTO sessions(id,track_id,snapshot) VALUES($1,$2,$3)', [
      id,
      track.id,
      JSON.stringify(track),
    ]);
    return id;
  });
}
export async function sessionView(id: string): Promise<SessionView> {
  const { rows } = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
  const session = rows[0];
  if (!session) throw new AppError(404, 'Сессия не найдена');
  const snapshot = session.snapshot as Track;
  const answers = await pool.query(
    'SELECT a.*, e.result FROM answers a LEFT JOIN assessments e ON e.answer_id=a.id WHERE session_id=$1 ORDER BY a.created_at',
    [id],
  );
  return {
    id,
    status: session.status,
    position: session.position,
    revision: session.revision,
    createdAt: session.created_at.toISOString(),
    completedAt: session.completed_at?.toISOString() ?? null,
    version: snapshot.version,
    exercises: snapshot.exercises.map(publicExercise),
    skills: snapshot.skills,
    sources: snapshot.sources.map(({ excerpt: _excerpt, ...source }) => source),
    answers: answers.rows.map((a) => ({
      id: a.id,
      exerciseId: a.exercise_id,
      value: a.value,
      state: a.state,
      error: a.error,
      assessment: a.result ?? null,
    })),
  };
}
export async function saveAssessment(db: PoolClient, answerId: string, result: Assessment) {
  await db.query('INSERT INTO assessments(answer_id,result,category) VALUES($1,$2,$3)', [
    answerId,
    JSON.stringify(result),
    category(result),
  ]);
  await db.query("UPDATE answers SET state='assessed',error=NULL WHERE id=$1", [answerId]);
  await db.query(
    "UPDATE sessions SET status='completed',completed_at=now(),revision=revision+1 WHERE id=(SELECT session_id FROM answers WHERE id=$1) AND (SELECT count(*) FROM answers WHERE session_id=sessions.id AND state='assessed')=5",
    [answerId],
  );
}
async function enqueue(db: PoolClient, answerId: string) {
  const attemptId = randomUUID();
  await db.query("INSERT INTO assessment_attempts(id,answer_id,state) VALUES($1,$2,'queued')", [
    attemptId,
    answerId,
  ]);
  await db.query("UPDATE answers SET state='submitted',error=NULL,attempt_id=$2 WHERE id=$1", [
    answerId,
    attemptId,
  ]);
}
export async function submitAnswer(id: string, exerciseId: string, value: string) {
  return transaction(async (db) => {
    const s = await lockedSession(db, id);
    const existing = await db.query(
      'SELECT id,value FROM answers WHERE session_id=$1 AND exercise_id=$2',
      [id, exerciseId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].value !== value)
        throw new AppError(409, 'Ответ уже принят и не может быть изменён');
      return existing.rows[0].id as string;
    }
    const e = s.snapshot.exercises[s.position];
    if (s.status !== 'active' || e.id !== exerciseId)
      throw new AppError(409, 'Откройте текущее задание');
    if (!value.trim() || value.length > 8000)
      throw new AppError(400, 'Ответ должен содержать от 1 до 8000 символов');
    if (e.type === 'choice' && !e.options.some((o) => o.id === value))
      throw new AppError(400, 'Выберите один из предложенных вариантов');
    if (e.type === 'open') {
      try {
        preparePrompt(e, s.snapshot, value);
      } catch {
        throw new AppError(
          400,
          'Ответ слишком длинный вместе с материалом задания. Сократите текст; черновик остаётся в форме.',
        );
      }
    }
    const answerId = randomUUID();
    await db.query(
      "INSERT INTO answers(id,session_id,exercise_id,value,state) VALUES($1,$2,$3,$4,'submitted')",
      [answerId, id, exerciseId, value],
    );
    if (e.type === 'choice') await saveAssessment(db, answerId, assessChoice(e, value));
    else await enqueue(db, answerId);
    return answerId;
  });
}
export async function retryAnswer(answerId: string) {
  return transaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM answers WHERE id=$1 FOR UPDATE', [answerId]);
    if (!rows[0]) throw new AppError(404, 'Ответ не найден');
    if (rows[0].state === 'failed') await enqueue(db, answerId);
    return rows[0].session_id as string;
  });
}
export async function advanceSession(id: string, revision: number, exerciseId: string) {
  await transaction(async (db) => {
    const s = await lockedSession(db, id);
    if (
      s.revision !== revision ||
      s.snapshot.exercises[s.position].id !== exerciseId ||
      s.status !== 'active'
    )
      throw new AppError(409, 'Шаг уже изменился. Обновите сессию.');
    const answer = await db.query(
      "SELECT id FROM answers WHERE session_id=$1 AND exercise_id=$2 AND state='assessed'",
      [id, exerciseId],
    );
    if (!answer.rows[0] || s.position === 4) throw new AppError(409, 'Сначала дождитесь оценки');
    await db.query('UPDATE sessions SET position=position+1,revision=revision+1 WHERE id=$1', [id]);
  });
}
