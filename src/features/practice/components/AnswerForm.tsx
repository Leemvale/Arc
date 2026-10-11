import type { SessionView } from '../../../../shared/domain.js';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage.js';
import { Feedback } from './Feedback.js';
import { useAnswerForm } from '../useAnswerForm.js';

export function AnswerForm({
  session,
  onUpdate,
}: {
  session: SessionView;
  onUpdate: (s: SessionView) => void;
}) {
  const { exercise, answer, value, storageError, change, submit, retry, advance, onSubmit } =
    useAnswerForm(session, onUpdate);
  return (
    <>
      <div className="eyebrow">
        ТРЕНИРОВКА · {exercise.type === 'choice' ? 'ВЫБОР ОТВЕТА' : 'ОТКРЫТЫЙ ОТВЕТ'}
      </div>
      <div className="progress-label">
        <span>Задание {session.position + 1} из 5</span>
        <span>{session.skills.find((s) => s.id === exercise.skillId)?.name}</span>
      </div>
      <progress value={session.position} max={5} aria-label="Пройдено заданий" />
      <section className="question">
        <h1>{exercise.prompt}</h1>
        <form onSubmit={onSubmit}>
          <fieldset disabled={!!answer || submit.isPending}>
            <legend className="sr-only">Ваш ответ</legend>
            {exercise.type === 'choice' ? (
              exercise.options!.map((o) => (
                <label
                  className={`option ${(answer?.value ?? value) === o.id ? 'selected' : ''}`}
                  key={o.id}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={o.id}
                    checked={(answer?.value ?? value) === o.id}
                    onChange={() => change(o.id)}
                  />
                  <span>{o.label}</span>
                </label>
              ))
            ) : (
              <>
                <label htmlFor="answer">Ваш ответ</label>
                <textarea
                  id="answer"
                  rows={7}
                  maxLength={8000}
                  value={answer?.value ?? value}
                  onChange={(e) => change(e.target.value)}
                  placeholder="Объясните своими словами…"
                />
                <span className="muted">{(answer?.value ?? value).length} / 8000</span>
              </>
            )}
          </fieldset>
          {!answer && (
            <div className="form-footer">
              <span className="muted">
                {storageError || 'Черновик сохраняется в этом браузере'}
              </span>
              <button
                type="submit"
                className="primary"
                disabled={!value.trim() || submit.isPending}
              >
                {submit.isPending ? 'Сохраняем…' : 'Проверить ответ →'}
              </button>
            </div>
          )}
        </form>
        {storageError && <p role="alert">{storageError}</p>}
        <ErrorMessage error={submit.error ?? retry.error ?? advance.error} />
        {answer && ['submitted', 'evaluating'].includes(answer.state) && (
          <p className="notice" role="status">
            Ответ сохранён. Проверяем по критериям…
          </p>
        )}
        {answer?.state === 'failed' && (
          <div className="notice error" role="alert">
            <p>{answer.error}</p>
            <p>Это техническая ошибка, она не влияет на учебный результат.</p>
            <button disabled={retry.isPending} onClick={() => retry.mutate()}>
              Повторить проверку
            </button>
          </div>
        )}
        {answer?.assessment && (
          <>
            <Feedback assessment={answer.assessment} sources={session.sources} />
            <div className="form-footer">
              <span className="muted">Ответ сохранён и больше не редактируется</span>
              <button
                className="primary"
                disabled={advance.isPending}
                onClick={() => advance.mutate()}
              >
                Далее →
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
