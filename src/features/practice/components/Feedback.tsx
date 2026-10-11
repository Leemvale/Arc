import { category, type Assessment, type SessionView } from '../../../../shared/domain.js';
const categoryLabel = { correct: 'Верно', partial: 'Частично', incorrect: 'Неверно' };

export function Feedback({
  assessment,
  sources,
}: {
  assessment: Assessment;
  sources: SessionView['sources'];
}) {
  return (
    <section className="feedback" aria-label="Разбор ответа">
      <span className={`pill ${category(assessment)}`}>{categoryLabel[category(assessment)]}</span>
      <h3>Разбор ответа</h3>
      <p>{assessment.explanation}</p>
      <ul className="criteria">
        {assessment.criteria.map((c) => (
          <li key={c.criterionId}>
            <span className={c.met ? 'criterion-met' : 'criterion-missing'}>
              {c.met ? '✓ Выполнен' : '○ Не выполнен'}
            </span>
            <p>{c.explanation}</p>
          </li>
        ))}
      </ul>
      {assessment.understood.length > 0 && (
        <>
          <h4>Что понято</h4>
          <ul>
            {assessment.understood.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {assessment.missingOrIncorrect.length > 0 && (
        <>
          <h4>Что стоит разобрать</h4>
          <ul>
            {assessment.missingOrIncorrect.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      <div className="source-links">
        {assessment.sourceIds.map((id) => {
          const s = sources.find((item) => item.id === id);
          return s ? (
            <a key={id} href={s.url} target="_blank" rel="noreferrer">
              {s.title} ↗
            </a>
          ) : null;
        })}
      </div>
    </section>
  );
}
