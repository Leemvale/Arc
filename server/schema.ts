export const migration = `
CREATE TABLE IF NOT EXISTS migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (
 id uuid PRIMARY KEY, track_id text NOT NULL, snapshot jsonb NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
 position integer NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 4), revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_session ON sessions(track_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS answers (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id), exercise_id text NOT NULL,
 value text NOT NULL, state text NOT NULL CHECK(state IN ('submitted','evaluating','failed','assessed')),
 error text, attempt_id uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,exercise_id)
);
CREATE TABLE IF NOT EXISTS assessments (
 answer_id uuid PRIMARY KEY REFERENCES answers(id), result jsonb NOT NULL,
 category text NOT NULL CHECK(category IN ('correct','partial','incorrect')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS experiment_budget (
 id integer PRIMARY KEY CHECK(id=1), limit_usd numeric(14,8) NOT NULL,
 spent numeric(14,8) NOT NULL DEFAULT 0 CHECK(spent>=0), reserved numeric(14,8) NOT NULL DEFAULT 0 CHECK(reserved>=0)
);
CREATE TABLE IF NOT EXISTS assessment_attempts (
 id uuid PRIMARY KEY, answer_id uuid REFERENCES answers(id), kind text NOT NULL DEFAULT 'practice',
 state text NOT NULL CHECK(state IN ('queued','running','failed','completed')),
 deadline timestamptz, reserve numeric(14,8) NOT NULL DEFAULT 0,
 cost numeric(14,8), input_tokens integer, output_tokens integer,
 model text, prompt_version text, rubric_version text, error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_running_attempt ON assessment_attempts(answer_id) WHERE state IN ('queued','running');
INSERT INTO migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
`;
