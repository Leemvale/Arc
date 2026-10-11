import { Sidebar } from './Sidebar.js';
import { TrackPage } from '../features/track/index.js';
import { SessionPage } from '../features/practice/index.js';
import { useHashRoute } from '../shared/lib/navigation.js';

export default function App() {
  const match = useHashRoute();
  // Callback ref scrolls only when a linked result is rendered, without managing derived state.
  return (
    <div className="app">
      <Sidebar inSession={!!match} />
      <div className="workspace">
        <header className="topbar">
          <span>
            Моё обучение <span className="breadcrumb-divider">/</span>{' '}
            <strong>{match ? 'Практика' : 'Обзор трека'}</strong>
          </span>
          <span className="local-badge">
            <span className="online-dot" /> Личный трек
          </span>
        </header>
        <main
          ref={(node) => {
            if (node && match?.[3])
              requestAnimationFrame(() =>
                document
                  .getElementById(`answer-${match[3]}`)
                  ?.scrollIntoView({ behavior: 'smooth' }),
              );
          }}
        >
          {match ? (
            <>
              <a className="back-link" href="#/">
                ← К треку
              </a>
              <SessionPage key={match[2]} id={match[2]} result={match[1] === 'result'} />
            </>
          ) : (
            <TrackPage />
          )}
        </main>
        <footer>
          <span>ARC / УЧИТЬСЯ ЧЕРЕЗ ПРАКТИКУ</span>
          <span>Один шаг за раз.</span>
        </footer>
      </div>
    </div>
  );
}
