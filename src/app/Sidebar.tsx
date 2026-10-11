import { Icon } from '../shared/ui/Icon.js';

export function Sidebar({ inSession }: { inSession: boolean }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#/" aria-label="Arc — главная">
        <span className="brand-mark">✧</span> arc<span className="brand-dot">.</span>
      </a>
      <span className="sidebar-caption">ВАШЕ ПРОСТРАНСТВО</span>
      <nav aria-label="Основная навигация">
        <a
          href="#/"
          className={!inSession ? 'nav-active' : undefined}
          aria-current={!inSession ? 'page' : undefined}
        >
          <Icon name="home" />
          Обзор трека
        </a>
        <a href="#skills">
          <Icon name="map" />
          Карта навыков
        </a>
        <a href="#history">
          <Icon name="chart" />
          Мои результаты
        </a>
        <a href="#materials">
          <Icon name="book" />О треке
        </a>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-quote">
          <Icon name="spark" />
          <p>
            Большие открытия
            <br />
            начинаются с<br />
            маленьких шагов.
          </p>
        </div>
        <div className="profile">
          <span className="avatar">A</span>
          <div>
            <strong>Моё пространство</strong>
            <span>Учусь в своём темпе</span>
          </div>
          <span className="online-dot" />
        </div>
      </div>
    </aside>
  );
}
