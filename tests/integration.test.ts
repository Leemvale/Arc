import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { migration } from '../server/schema.js';
import { track } from '../content/track.js';
import { type Assessment, type Exercise, skillSummary } from '../shared/domain.js';
import { evaluationExamples } from '../content/evaluation.js';

test('PostgreSQL session lifecycle, recovery, concurrency and budget', async (t) => {
  const baseUrl = process.env.DATABASE_URL ?? 'postgres://arc:arc-local-only@127.0.0.1:54329/arc';
  const schema = `arc_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: baseUrl });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(baseUrl);
  url.searchParams.set('options', `-csearch_path=${schema}`);
  process.env.DATABASE_URL = url.toString();
  const { pool, transaction } = await import('../server/db.js');
  const { startSession, sessionView, submitAnswer, retryAnswer, advanceSession } =
    await import('../server/sessions.js');
  const { runOne, recoverExpired } = await import('../server/worker.js');
  const { reserve, settle, maxCost } = await import('../server/budget.js');
  const { createApp } = await import('../server/app.js');
  const ready = () => {};
  const result = (e: Exercise): Assessment => ({
    criteria: e.criteria.map((c) => ({ criterionId: c.id, met: true, explanation: c.description })),
    understood: ['Понимание подтверждено в этом ответе'],
    missingOrIncorrect: [],
    explanation: 'Тестовый результат, не AI-оценка.',
    sourceIds: e.sourceIds,
  });
  const fake = async (e: Exercise) => ({ result: result(e), inputTokens: 100, outputTokens: 100 });
  const app = createApp();
  try {
    await pool.query(migration);
    await pool.query(migration);
    await pool.query('INSERT INTO experiment_budget(id,limit_usd) VALUES(1,5)');
    let id = '';
    await t.test('concurrent start returns one active session', async () => {
      const ids = await Promise.all(Array.from({ length: 6 }, () => startSession()));
      assert.equal(new Set(ids).size, 1);
      id = ids[0];
    });
    await t.test('validation and repeat submit preserve one immutable answer', async () => {
      await assert.rejects(submitAnswer(id, 'main-or-change', ''));
      await assert.rejects(submitAnswer(id, 'main-or-change', 'unknown'));
      await assert.rejects(submitAnswer(id, 'design-role', 'design'));
      await assert.rejects(advanceSession(id, 0, 'main-or-change'));
      const ids = await Promise.all([
        submitAnswer(id, 'main-or-change', 'delta'),
        submitAnswer(id, 'main-or-change', 'delta'),
      ]);
      assert.equal(ids[0], ids[1]);
      await assert.rejects(submitAnswer(id, 'main-or-change', 'main'));
      assert.equal((await sessionView(id)).answers.length, 1);
    });
    await t.test('advance cannot skip and snapshots are immutable', async () => {
      await advanceSession(id, 0, 'main-or-change');
      await assert.rejects(advanceSession(id, 0, 'main-or-change'));
      const original = track.title;
      track.title = 'Changed';
      assert.equal(
        (await pool.query('SELECT snapshot FROM sessions WHERE id=$1', [id])).rows[0].snapshot
          .title,
        original,
      );
      track.title = original;
      await submitAnswer(id, 'design-role', 'design');
      await advanceSession(id, 1, 'design-role');
    });
    let answerId = '';
    await t.test('provider error is recoverable, no grade or loss of answer', async () => {
      await assert.rejects(submitAnswer(id, 'explain-specs', 'я'.repeat(8001)));
      answerId = await submitAnswer(id, 'explain-specs', evaluationExamples[0].answer);
      await runOne(async () => {
        throw new Error('offline');
      }, ready);
      const answer = (await sessionView(id)).answers.find((a) => a.id === answerId)!;
      assert.equal(answer.state, 'failed');
      assert.equal(answer.assessment, null);
      assert.equal(answer.value, evaluationExamples[0].answer);
      await assert.rejects(advanceSession(id, 2, 'explain-specs'));
    });
    await t.test('invalid response is a technical failure', async () => {
      await retryAnswer(answerId);
      await runOne(
        async (e) => ({ ...(await fake(e)), result: { ...result(e), sourceIds: ['invented'] } }),
        ready,
      );
      assert.equal((await sessionView(id)).answers.find((a) => a.id === answerId)!.state, 'failed');
    });
    await t.test('database failure preserves answer and reserved cost until recovery', async () => {
      await retryAnswer(answerId);
      await pool.query(
        "CREATE FUNCTION reject_grade() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated storage failure'; END $$; CREATE TRIGGER reject_grade BEFORE INSERT ON assessments FOR EACH ROW EXECUTE FUNCTION reject_grade();",
      );
      await assert.rejects(runOne(fake, ready));
      const answer = (await sessionView(id)).answers.find((a) => a.id === answerId)!;
      assert.equal(answer.assessment, null);
      assert.equal(answer.value, evaluationExamples[0].answer);
      assert.equal(answer.state, 'evaluating');
      assert.ok(
        Number((await pool.query('SELECT reserved FROM experiment_budget')).rows[0].reserved) > 0,
      );
      await pool.query('DROP TRIGGER reject_grade ON assessments; DROP FUNCTION reject_grade();');
      await pool.query(
        "UPDATE assessment_attempts SET deadline=now()-interval '1 second' WHERE answer_id=$1 AND state='running'",
        [answerId],
      );
      await recoverExpired();
      assert.equal((await sessionView(id)).answers.find((a) => a.id === answerId)!.state, 'failed');
    });
    await t.test('successful retry saves one grade and does not reevaluate', async () => {
      await Promise.all([retryAnswer(answerId), retryAnswer(answerId)]);
      await runOne(fake, ready);
      await retryAnswer(answerId);
      assert.equal(
        await runOne(async () => {
          throw Error('must not call');
        }, ready),
        false,
      );
      assert.equal(
        (await pool.query('SELECT * FROM assessments WHERE answer_id=$1', [answerId])).rowCount,
        1,
      );
      await advanceSession(id, 2, 'explain-specs');
    });
    await t.test(
      'stale attempt is charged conservatively; late completion cannot replace retry',
      async () => {
        const a = await submitAnswer(id, 'explain-artifacts', evaluationExamples[6].answer);
        let release!: () => void;
        const wait = new Promise<void>((r) => {
          release = r;
        });
        let entered!: () => void;
        const started = new Promise<void>((r) => {
          entered = r;
        });
        const running = runOne(async (e) => {
          entered();
          await wait;
          return fake(e);
        }, ready);
        await started;
        await pool.query(
          "UPDATE assessment_attempts SET deadline=now()-interval '1 second' WHERE answer_id=$1",
          [a],
        );
        await recoverExpired();
        await retryAnswer(a);
        release();
        await running;
        assert.equal((await sessionView(id)).answers.find((v) => v.id === a)!.assessment, null);
        await runOne(fake, ready);
        await advanceSession(id, 3, 'explain-artifacts');
      },
    );
    await t.test('final assessment completes session and history survives repeat', async () => {
      await submitAnswer(id, 'write-scenario', evaluationExamples[12].answer);
      await runOne(fake, ready);
      const s = await sessionView(id);
      assert.equal(s.status, 'completed');
      assert.equal(s.answers.length, 5);
      assert.deepEqual(
        skillSummary(s).map((v) => v.status),
        ['met', 'met', 'met', 'untested', 'untested', 'untested'],
      );
      const mixed = structuredClone(s);
      mixed.answers.find((a) => a.exerciseId === 'explain-specs')!.assessment!.criteria[0].met =
        false;
      const summary = skillSummary(mixed).find((v) => v.id === 'structure')!;
      assert.equal(summary.status, 'review');
      assert.equal(summary.evidence.length, 2);
      const newId = await startSession();
      assert.notEqual(newId, id);
      assert.deepEqual((await sessionView(id)).answers, s.answers);
    });
    await t.test('budget reserves atomically and blocks requests over cap', async () => {
      await pool.query('UPDATE experiment_budget SET limit_usd=spent+$1 WHERE id=1', [maxCost()]);
      const attemptIds = [randomUUID(), randomUUID()];
      for (const a of attemptIds)
        await pool.query(
          "INSERT INTO assessment_attempts(id,kind,state) VALUES($1,'eval','queued')",
          [a],
        );
      const results = await Promise.allSettled(
        attemptIds.map((a) => transaction((db) => reserve(db, a))),
      );
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      const a = (
        await pool.query(
          'SELECT * FROM assessment_attempts WHERE id=ANY($1::uuid[]) AND reserve>0',
          [attemptIds],
        )
      ).rows[0];
      await transaction((db) => settle(db, a));
      assert.equal(
        Number((await pool.query('SELECT reserved FROM experiment_budget')).rows[0].reserved),
        0,
      );
    });
    await t.test(
      'missing key, unconfirmed pricing and empty budget preserve open answers',
      async () => {
        const { config } = await import('../server/config.js');
        const savedKey = config.OPENAI_API_KEY;
        const savedPricing = config.OPENAI_PRICING_CONFIRMED;
        const newId = await startSession();
        await submitAnswer(newId, 'main-or-change', 'delta');
        await advanceSession(newId, 0, 'main-or-change');
        await submitAnswer(newId, 'design-role', 'design');
        await advanceSession(newId, 1, 'design-role');
        const a = await submitAnswer(newId, 'explain-specs', evaluationExamples[0].answer);
        try {
          config.OPENAI_API_KEY = '';
          await runOne(fake);
          assert.match(
            (await sessionView(newId)).answers.find((v) => v.id === a)!.error!,
            /не настроен/,
          );
          config.OPENAI_API_KEY = 'test-key-not-real';
          config.OPENAI_PRICING_CONFIRMED = 'false';
          await retryAnswer(a);
          await runOne(fake);
          assert.match(
            (await sessionView(newId)).answers.find((v) => v.id === a)!.error!,
            /тарифы/,
          );
          await retryAnswer(a);
          await runOne(async () => {
            throw Error('must not invoke');
          }, ready);
          const view = (await sessionView(newId)).answers.find((v) => v.id === a)!;
          assert.match(view.error!, /Лимит/);
          assert.equal(view.assessment, null);
          assert.equal(view.value, evaluationExamples[0].answer);
        } finally {
          config.OPENAI_API_KEY = savedKey;
          config.OPENAI_PRICING_CONFIRMED = savedPricing;
        }
      },
    );
    await t.test(
      'actual server process restart retains completed and active sessions',
      async () => {
        const activeId = await startSession();
        const before = await sessionView(activeId);
        for (let restart = 0; restart < 2; restart++) {
          const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
            env: { ...process.env, PORT: '31003', OPENAI_API_KEY: '' },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          try {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(Error('Test server startup timeout')), 10000);
              child.stdout.on('data', (chunk) => {
                if (String(chunk).includes('Arc:')) {
                  clearTimeout(timeout);
                  resolve();
                }
              });
              child.once('exit', () => {
                clearTimeout(timeout);
                reject(Error('Test server exited before startup'));
              });
            });
            const completed = await fetch(`http://127.0.0.1:31003/api/sessions/${id}/result`).then(
              (r) => r.json(),
            );
            assert.equal(completed.answers.length, 5);
            const active = await fetch(`http://127.0.0.1:31003/api/sessions/${activeId}`).then(
              (r) => r.json(),
            );
            assert.deepEqual(active, before);
          } finally {
            const exited = once(child, 'exit');
            child.kill('SIGTERM');
            await exited;
          }
        }
      },
    );
    await t.test('local API rejects hostile origin and host, result has no secrets', async () => {
      const headers = {
        host: '127.0.0.1:3001',
        origin: 'http://127.0.0.1:3001',
        'content-type': 'application/json',
      };
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/api/sessions',
            headers: { ...headers, origin: 'https://evil.example' },
            payload: {},
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (await app.inject({ url: '/api/track', headers: { host: 'evil.example' } })).statusCode,
        403,
      );
      const response = await app.inject({ url: `/api/sessions/${id}/result`, headers });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.includes('correctOptionId'), false);
      assert.equal(response.body.includes('OPENAI_API_KEY'), false);
    });
  } finally {
    await app.close();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

test('evaluation fixtures cover every category for each open exercise', () => {
  for (const e of track.exercises.filter((e) => e.type === 'open')) {
    const cases = evaluationExamples.filter((v) => v.exerciseId === e.id && !v.adversarial);
    assert.equal(cases.length, 6);
    assert.equal(cases.filter((v) => v.expected.every(Boolean)).length, 2);
    assert.equal(cases.filter((v) => v.expected.every((v) => !v)).length, 2);
    assert.ok(cases.every((v) => v.expected.length === e.criteria.length));
  }
});
