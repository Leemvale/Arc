import './practice.css';
import { ErrorMessage } from '../../shared/ui/ErrorMessage.js';
import { AnswerForm } from './components/AnswerForm.js';
import { Results } from './components/Results.js';
import { useSession } from './useSession.js';

export function SessionPage({ id, result }: { id: string; result: boolean }) {
  const { query, update } = useSession(id, result);
  if (query.isPending) return <p role="status">Восстанавливаем сессию…</p>;
  if (query.error)
    return (
      <>
        <ErrorMessage error={query.error} />
        <button onClick={() => void query.refetch()}>Повторить</button>
      </>
    );
  const session = query.data;
  if (session.status === 'completed') return <Results session={session} />;
  return (
    <div className="practice-layout">
      <div className="practice-content">
        <AnswerForm key={`${id}:${session.position}`} session={session} onUpdate={update} />
      </div>
      <aside className="practice-scene" aria-label="Напоминание">
        <div>
          <span className="eyebrow">В ВАШЕМ ТЕМПЕ</span>
          <h2>
            Дайте себе время
            <br />
            разобраться.
          </h2>
          <p>
            Не страшно чего-то не знать.
            <br />
            Для этого мы и учимся.
          </p>
        </div>
      </aside>
    </div>
  );
}
