import test from 'node:test';
import assert from 'node:assert/strict';
import { track } from '../content/track.js';
import { trackSchema, assessChoice, category, validateAssessment } from '../shared/domain.js';
test('content rejects missing or mutable sources and unknown skills', () => {
  assert.throws(() => trackSchema.parse({ ...track, sourceCommit: 'main' }));
  assert.throws(() => trackSchema.parse({ ...track, sources: [] }));
  assert.throws(() => trackSchema.parse({ ...track, skills: [] }));
});
test('all multiple choice options have deterministic results', () => {
  for (const e of track.exercises)
    if (e.type === 'choice')
      for (const o of e.options) {
        assert.equal(
          category(validateAssessment(assessChoice(e, o.id), e)),
          o.id === e.correctOptionId ? 'correct' : 'incorrect',
        );
      }
});
test('assessment rejects invented source and repeated criterion', () => {
  const e = track.exercises[0];
  const result = assessChoice(e, 'delta');
  assert.throws(() => validateAssessment({ ...result, sourceIds: ['invented'] }, e));
  assert.throws(() =>
    validateAssessment({ ...result, criteria: [...result.criteria, ...result.criteria] }, e),
  );
});
