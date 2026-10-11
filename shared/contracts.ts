import type { Track } from './domain.js';

export type TrackView = Pick<
  Track,
  'id' | 'title' | 'description' | 'goal' | 'skills' | 'sourceCommit' | 'sourceContext'
> & {
  sessions: { id: string; status: string; created_at: string; completed_at: string | null }[];
  budget: { limit_usd: string; spent: string; reserved: string };
};
