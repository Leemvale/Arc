import { z } from 'zod';

const text = z.string().trim().min(1);
const criterion = z.strictObject({ id: text, description: text });
const baseExercise = {
  id: text,
  skillId: text,
  prompt: text,
  criteria: z.array(criterion).min(1),
  sourceIds: z.array(text).min(1),
  explanation: text,
};
export const exerciseSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...baseExercise, type: z.literal('open') }),
  z.strictObject({
    ...baseExercise,
    type: z.literal('choice'),
    options: z.array(z.strictObject({ id: text, label: text })).min(2),
    correctOptionId: text,
  }),
]);
export const trackSchema = z
  .strictObject({
    id: text,
    version: text,
    title: text,
    goal: z.literal('Improve'),
    description: text,
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
    sourceContext: text,
    skills: z.array(z.strictObject({ id: text, name: text })).min(3),
    sources: z.array(z.strictObject({ id: text, title: text, url: z.url(), excerpt: text })).min(1),
    exercises: z.array(exerciseSchema).length(5),
  })

  .superRefine((track, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    for (const values of [track.skills, track.sources, track.exercises]) {
      if (new Set(values.map((v) => v.id)).size !== values.length)
        issue('Повторяющийся идентификатор');
    }
    if (track.exercises.map((e) => e.type).join(',') !== 'choice,choice,open,open,open')
      issue('Неверная последовательность');
    for (const source of track.sources) {
      if (
        !source.url.startsWith(
          `https://github.com/Fission-AI/OpenSpec/blob/${track.sourceCommit}/docs/`,
        ) ||
        !source.url.includes('#')
      )
        issue('Источник должен быть закреплён');
    }
    for (const exercise of track.exercises) {
      if (!track.skills.some((s) => s.id === exercise.skillId)) issue('Неизвестный навык');
      if (exercise.sourceIds.some((id) => !track.sources.some((s) => s.id === id)))
        issue('Неизвестный источник');
      if (new Set(exercise.criteria.map((c) => c.id)).size !== exercise.criteria.length)
        issue('Повтор критерия');
      if (
        exercise.type === 'choice' &&
        (!exercise.options.some((o) => o.id === exercise.correctOptionId) ||
          new Set(exercise.options.map((o) => o.id)).size !== exercise.options.length ||
          exercise.criteria.length !== 1)
      )
        issue('Неверный ключ multiple choice');
    }
  });
export type Track = z.infer<typeof trackSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export const assessmentSchema = z.strictObject({
  criteria: z
    .array(z.strictObject({ criterionId: text, met: z.boolean(), explanation: text }))
    .min(1),
  understood: z.array(text),
  missingOrIncorrect: z.array(text),
  explanation: text,
  sourceIds: z.array(text).min(1),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export type Category = 'correct' | 'partial' | 'incorrect';
export function category(result: Assessment): Category {
  const count = result.criteria.filter((c) => c.met).length;
  return count === result.criteria.length ? 'correct' : count ? 'partial' : 'incorrect';
}
export function validateAssessment(value: unknown, exercise: Exercise): Assessment {
  const result = assessmentSchema.parse(value);
  const ids = result.criteria.map((c) => c.criterionId);
  if (
    ids.length !== exercise.criteria.length ||
    new Set(ids).size !== ids.length ||
    exercise.criteria.some((c) => !ids.includes(c.id))
  )
    throw new Error('Набор критериев не соответствует рубрике');
  if (result.sourceIds.some((id) => !exercise.sourceIds.includes(id)))
    throw new Error('Неизвестный источник оценки');
  return result;
}
export function assessChoice(exercise: Exercise, answer: string): Assessment {
  if (exercise.type !== 'choice') throw new Error('Ожидался multiple choice');
  const met = answer === exercise.correctOptionId;
  return {
    criteria: [{ criterionId: exercise.criteria[0].id, met, explanation: exercise.explanation }],
    understood: met ? [exercise.criteria[0].description] : [],
    missingOrIncorrect: met ? [] : [exercise.criteria[0].description],
    explanation: exercise.explanation,
    sourceIds: exercise.sourceIds,
  };
}
export type PublicExercise = Omit<
  Exercise,
  'criteria' | 'correctOptionId' | 'explanation' | 'sourceIds'
> & { options?: { id: string; label: string }[] };
export function publicExercise(e: Exercise): PublicExercise {
  return {
    id: e.id,
    type: e.type,
    skillId: e.skillId,
    prompt: e.prompt,
    ...(e.type === 'choice' ? { options: e.options } : {}),
  };
}
export type AnswerView = {
  id: string;
  exerciseId: string;
  value: string;
  state: string;
  error: string | null;
  assessment: Assessment | null;
};
export type SessionView = {
  id: string;
  status: string;
  position: number;
  revision: number;
  createdAt: string;
  completedAt: string | null;
  version: string;
  exercises: PublicExercise[];
  skills: Track['skills'];
  sources: Omit<Track['sources'][number], 'excerpt'>[];
  answers: AnswerView[];
};
export function skillSummary(session: SessionView) {
  return session.skills.map((skill) => {
    const evidence = session.answers.filter(
      (a) =>
        a.assessment && session.exercises.find((e) => e.id === a.exerciseId)?.skillId === skill.id,
    );
    return {
      ...skill,
      evidence,
      status:
        evidence.length === 0
          ? 'untested'
          : evidence.every((a) => a.assessment!.criteria.every((c) => c.met))
            ? 'met'
            : 'review',
    };
  });
}
