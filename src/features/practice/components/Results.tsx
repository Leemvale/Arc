import { skillSummary, type SessionView } from '../../../../shared/domain.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { date } from '../../../shared/lib/date.js';
import { Feedback } from './Feedback.js';
import { useStartSession } from '../useStartSession.js';

export function Results({ session }: { session: SessionView }) {
  const start = useStartSession();
  const criteria = session.answers.flatMap((answer) => answer.assessment?.criteria ?? []);
  const met = criteria.filter((criterion) => criterion.met).length;
  return (
    <>
      <div className="eyebrow">ТРЕНИРОВКА ЗАВЕРШЕНА</div>
      <h1>
        Пять ответов.
        <br />
        Новые точки роста.
      </h1>
      <p className="lead">
        Результат сохранён · {date(session.completedAt!)} · Версия трека {session.version}
      </p>
      <p className="muted">
        Это результат одной тренировки, а не оценка устойчивого владения навыками.
      </p>
      <div className="result-stats" aria-label="Итоги тренировки">
        <div>
          <strong>{session.answers.length}</strong>
          <span>Ответов сохранено</span>
        </div>
        <div>
          <strong>
            {met} / {criteria.length}
          </strong>
          <span>Критериев выполнено</span>
        </div>
        <div>
          <strong>
            {
              session.skills.filter((skill) =>
                session.exercises.some((exercise) => exercise.skillId === skill.id),
              ).length
            }
          </strong>
          <span>Тем в тренировке</span>
        </div>
      </div>
      <section className="section">
        <h2>Что показала эта сессия</h2>
        <div className="summary-list">
          {skillSummary(session).map((s) => (
            <article key={s.id}>
              <div>
                <h3>{s.name}</h3>
                <span className={`tag ${s.status === 'met' ? 'active' : ''}`}>
                  {s.status === 'untested'
                    ? 'Не проверялось'
                    : s.status === 'met'
                      ? 'Критерии выполнены в этой сессии'
                      : 'Стоит повторить'}
                </span>
              </div>
              {s.evidence.length > 0 && (
                <div>
                  {s.evidence.flatMap((a) =>
                    a
                      .assessment!.criteria.filter((c) => !c.met)
                      .map((c) => <p key={`${a.id}:${c.criterionId}`}>{c.explanation}</p>),
                  )}
                  <div className="evidence-links">
                    {s.evidence.map((a) => (
                      <a key={a.id} href={`#/result/${session.id}?answer=${a.exerciseId}`}>
                        Ответ {session.exercises.findIndex((e) => e.id === a.exerciseId) + 1} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Все ответы и разборы</h2>
        {session.exercises.map((e, i) => {
          const answer = session.answers.find((a) => a.exerciseId === e.id)!;
          return (
            <article className="answer-card" id={`answer-${e.id}`} key={e.id}>
              <span className="eyebrow">ЗАДАНИЕ {i + 1}</span>
              <h3>{e.prompt}</h3>
              <blockquote>
                {e.type === 'choice'
                  ? e.options?.find((o) => o.id === answer.value)?.label
                  : answer.value}
              </blockquote>
              <Feedback assessment={answer.assessment!} sources={session.sources} />
            </article>
          );
        })}
      </section>
      <ErrorMessage error={start.error} />
      <button className="primary" disabled={start.isPending} onClick={() => start.mutate()}>
        Пройти ещё раз →
      </button>
      <p className="muted">Новая сессия не изменит этот результат.</p>
    </>
  );
}
