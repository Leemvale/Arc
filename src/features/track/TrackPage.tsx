import { useStartSession } from '../practice/index.js';
import { ErrorMessage } from '../../shared/ui/ErrorMessage.js';
import { Icon } from '../../shared/ui/Icon.js';
import { date } from '../../shared/lib/date.js';
import { navigate } from '../../shared/lib/navigation.js';
import { scrollToHashTarget } from '../../shared/lib/scrollToHashTarget.js';
import { useTrack } from './useTrack.js';
import './track.css';

export function TrackPage() {
  const query = useTrack();
  const start = useStartSession();
  if (query.isPending) return <p role="status">Загружаем ваш трек…</p>;
  if (query.error)
    return (
      <>
        <ErrorMessage error={query.error} />
        <button onClick={() => void query.refetch()}>Повторить</button>
      </>
    );
  const data = query.data;
  const active = data.sessions.find((s) => s.status === 'active');
  const completed = data.sessions.filter((s) => s.status === 'completed');
  return (
    <>
      <section className="welcome-banner" aria-label="Пространство для учёбы">
        <div className="welcome-copy">
          <span className="eyebrow">МАЛЕНЬКИЕ ШАГИ. БОЛЬШИЕ ОТКРЫТИЯ.</span>
          <h2>
            Время для себя.
            <br />И новых знаний <span aria-hidden="true">✧</span>
          </h2>
          <p>
            Тихое место, чтобы разобраться в сложном.
            <br />
            Продолжим ваше путешествие?
          </p>
        </div>
        <span className="scene-caption">ОДИН ШАГ ЗА РАЗ</span>
      </section>
      <div className="track-layout">
        <div className="track-main">
          <section className="learning-card">
            <div className="section-heading">
              <span className="eyebrow">ВАШ УЧЕБНЫЙ ТРЕК · 01</span>
              <span className="pill">Improve · Практика</span>
            </div>
            <div className="track-title">
              <span className="track-icon" aria-hidden="true">
                ⌘
              </span>
              <h1>{data.title}</h1>
            </div>
            <p className="lead">{data.description}</p>
            <div className="session-plan">
              <span>
                <span className="plan-icon">✓</span> 5 заданий
              </span>
              <span>
                <span className="plan-icon">◷</span> Около 15 минут
              </span>
              <span>
                <span className="plan-icon">✧</span> С разбором ответов
              </span>
            </div>
            <div className="start-row">
              <button
                className="primary"
                disabled={start.isPending}
                onClick={() => (active ? navigate(`/session/${active.id}`) : start.mutate())}
              >
                {start.isPending
                  ? 'Начинаем…'
                  : active
                    ? 'Продолжить тренировку →'
                    : 'Начать тренировку →'}
              </button>
              <span className="muted">В вашем темпе. Без таймера.</span>
            </div>
            <ErrorMessage error={start.error} />
          </section>
          <section className="skills-section" id="skills" ref={scrollToHashTarget}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">ИЗУЧАЙТЕ. ПРАКТИКУЙТЕСЬ. ПОНИМАЙТЕ.</span>
                <h2>Карта навыков</h2>
              </div>
              <span className="count-badge">{data.skills.length} тем</span>
            </div>
            <div className="skills">
              {data.skills.map((s, i) => (
                <article className={`skill skill-${i % 3}`} key={s.id}>
                  <div className="skill-top">
                    <span className="skill-icon">
                      <Icon name={i % 3 === 0 ? 'map' : i % 3 === 1 ? 'book' : 'spark'} />
                    </span>
                    <span className="number">0{i + 1}</span>
                  </div>
                  <h3>{s.name}</h3>
                  <span className={i < 3 ? 'tag active' : 'tag'}>
                    <span aria-hidden="true">{i < 3 ? '●' : '○'}</span>{' '}
                    {i < 3 ? 'В тренировке' : 'Позже'}
                  </span>
                </article>
              ))}
            </div>
            <p className="skills-caption">
              В этой тренировке — первые три темы. Остальные ждут впереди.
            </p>
          </section>
          <section className="history-section" id="history" ref={scrollToHashTarget}>
            <div className="section-heading">
              <h2>Ваши тренировки</h2>
              <Icon name="chart" />
            </div>
            {completed.length ? (
              <div className="history">
                {completed.map((s) => (
                  <a href={`#/result/${s.id}`} key={s.id}>
                    <span>{date(s.completed_at!)}</span>
                    <span>Открыть разбор ↗</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="empty">
                <span className="empty-icon">
                  <Icon name="chart" />
                </span>
                <div>
                  <strong>Ваша история начинается здесь</strong>
                  <p>Здесь появятся сохранённые результаты после первой тренировки.</p>
                </div>
              </div>
            )}
          </section>
        </div>
        <aside className="track-aside" aria-label="Ваше обучение">
          <section className="journey-card">
            <span className="eyebrow">ВАШ ПУТЬ</span>
            <h2>Практика в привычку</h2>
            <div className="journey-orbit">
              <Icon name="spark" />
            </div>
            <div className="journey-stats">
              <div>
                <strong>{completed.length}</strong>
                <span>Завершено сессий</span>
              </div>
              <div>
                <strong>{data.skills.length}</strong>
                <span>Тем в треке</span>
              </div>
            </div>
            <p>
              {completed.length
                ? 'Каждая тренировка — новый взгляд на знакомые вещи.'
                : 'Первая тренировка — начало большого пути.'}
            </p>
          </section>
          <section className="inspiration-card">
            <div>
              <span className="eyebrow">БЕЗ СПЕШКИ</span>
              <h2>
                Не обязательно знать всё.
                <br />
                Достаточно начать.
              </h2>
              <span>Место для ваших маленьких побед.</span>
            </div>
          </section>
          <div className="gentle-note">
            <Icon name="spark" />
            <p>
              Ошибки — часть обучения.
              <br />
              <span>Каждый разбор помогает идти дальше.</span>
            </p>
          </div>
        </aside>
      </div>
      <details className="source-note" id="materials" ref={scrollToHashTarget}>
        <summary>Материалы и расходы API</summary>
        <p>{data.sourceContext}</p>
        <p>
          Ревизия документации: <code>{data.sourceCommit}</code>
        </p>
        <p>
          API: потрачено ${Number(data.budget.spent).toFixed(4)}, зарезервировано $
          {Number(data.budget.reserved).toFixed(4)} из ${Number(data.budget.limit_usd).toFixed(2)}.
          Это локальный учёт приложения.
        </p>
      </details>
    </>
  );
}
