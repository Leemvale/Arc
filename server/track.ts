import { pool } from './db.js';
import { track } from '../content/track.js';
import type { TrackView } from '../shared/contracts.js';

export async function getTrack(): Promise<TrackView> {
  const sessions = await pool.query(
    'SELECT id,status,created_at,completed_at FROM sessions WHERE track_id=$1 ORDER BY created_at DESC',
    [track.id],
  );
  const budget = await pool.query(
    'SELECT limit_usd,spent,reserved FROM experiment_budget WHERE id=1',
  );
  return {
    id: track.id,
    title: track.title,
    goal: track.goal,
    description: track.description,
    skills: track.skills,
    sourceCommit: track.sourceCommit,
    sourceContext: track.sourceContext,
    sessions: sessions.rows,
    budget: budget.rows[0],
  };
}
