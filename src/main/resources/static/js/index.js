const { useEffect, useState } = React;

function iconEmoji(name) {
  const map = {
    "clear-day": "☀️", "clear-night": "🌙",
    "mostly-clear-day": "🌤️", "mostly-clear-night": "🌤️",
    "partly-cloudy-day": "⛅", "partly-cloudy-night": "☁️",
    "overcast-day": "☁️", "overcast-night": "☁️",
    "fog-day": "🌫️", "fog-night": "🌫️", "rime-fog": "🌫️",
    "drizzle": "🌦️", "extreme-drizzle": "🌧️",
    "freezing-drizzle": "🌨️", "freezing-rain": "🌨️",
    "partly-cloudy-day-rain": "🌦️", "partly-cloudy-night-rain": "🌦️",
    "rain": "🌧️", "extreme-rain": "🌧️",
    "partly-cloudy-day-snow": "🌨️", "partly-cloudy-night-snow": "🌨️",
    "snow": "❄️", "extreme-snow": "❄️", "snowflake": "❄️",
    "thunderstorms-day": "⛈️", "thunderstorms-night": "⛈️",
    "thunderstorms-day-rain": "⛈️", "thunderstorms-night-rain": "⛈️",
    "thunderstorms-rain": "⛈️", "thunderstorms-extreme-rain": "⛈️",
    "not-available": "🌡️"
  };
  return map[name] || "🌡️";
}

function WeatherIcon({ name, className }) {
  const sizeMap = {
    "weather-icon-big": "3rem",
    "weather-icon-sm": "1.6rem",
    "weather-detail-icon": "5rem",
  };
  const fontSize = sizeMap[className] || "2rem";
  return <span style={{ fontSize, lineHeight: 1 }}>{iconEmoji(name)}</span>;
}

function Widget({ title, children }) {
  return (
    <div className="widget">
      <div className="widget-title">{title}</div>
      <div className="widget-body">{children}</div>
    </div>
  );
}

function formatHour(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

function WeatherWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/weather/details");
        if (!res.ok) throw new Error("Ошибка загрузки погоды");
        setData(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="widget weather-widget">
      <div className="widget-title">🌤 Погода</div>
      <div className="widget-body"><span className="small muted">Загрузка...</span></div>
    </div>
  );

  if (error) return (
    <div className="widget weather-widget">
      <div className="widget-title">🌤 Погода</div>
      <div className="widget-body"><span className="small" style={{color:"var(--danger)"}}>{error}</span></div>
    </div>
  );

  const { current, hourly, daily } = data;

  return (
    <a href="/weather" className="widget weather-widget widget-link">
      <div className="widget-title">🌤 Погода — {current.city}</div>
      <div className="widget-body">

        {/* Текущая погода */}
        <div className="weather-current">
          <div className="weather-main">
            <WeatherIcon name={current.icon} className="weather-icon-big" />
            <div>
              <div className="weather-temp">{Math.round(current.tempC)}°C</div>
              <div className="small">{current.description}</div>
            </div>
          </div>
          <div className="weather-feels">
            <span className="small muted">Ощущается как</span>
            <span className="small"> {Math.round(current.feelsLikeC)}°C</span>
          </div>
        </div>

        {/* Почасовой прогноз (превью — 6 часов) */}
        <div className="weather-scroll">
          {hourly.slice(0, 6).map((h, i) => (
            <div key={i} className="weather-scroll-item">
              <div className="small muted">{formatHour(h.time)}</div>
              <WeatherIcon name={h.icon} className="weather-icon-sm" />
              <div className="small" style={{fontWeight:700}}>{Math.round(h.tempC)}°</div>
            </div>
          ))}
          <div className="weather-scroll-item weather-scroll-more">
            <span className="small muted">Подробнее →</span>
          </div>
        </div>

      </div>
    </a>
  );
}

function CityPortalHome() {
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const [traffic] = useState({ level: "6/10", note: "Пробки средние" });
  const [taxi] = useState({ price: "≈ 450₽", eta: "7 мин" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/account", { credentials: "same-origin" });
        if (res.ok) {
          const data = await res.json();
          setAccount(data);
        }
      } catch (e) {
      } finally {
        setLoadingAccount(false);
      }
    })();
  }, []);

    async function getCsrfToken() {
      const res = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
      if (!res.ok) throw new Error("CSRF token request failed");
      const data = await res.json();
      return data.token;
    }

    async function logout() {
      try {
        const token = await getCsrfToken();

        await fetch("/logout", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRF-TOKEN": token
          },
          body: new URLSearchParams({ _csrf: token }).toString()
        });

        window.location.href = "/login?logout";
      } catch (e) {
        console.error("Logout failed", e);
        window.location.href = "/login";
      }
    }

  return (
    <div className="home">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo small" />
          <div>
            <div className="topbar-title">CityPortal</div>
            <div className="topbar-subtitle">Интерактивный портал города</div>
          </div>
        </div>

        <div className="topbar-right">
          {loadingAccount ? (
            <span className="small">Проверяем вход...</span>
          ) : account ? (
            <>
              <span className="small">Вы вошли как: <b>{account.login}</b></span>
              <a className="btn smallbtn secondary" href="/profile">Профиль</a>
              <button className="btn smallbtn secondary" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <a className="btn smallbtn secondary" href="/login">Войти</a>
              <a className="btn smallbtn" href="/register">Регистрация</a>
            </>
          )}
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1 className="hero-title">Добро пожаловать</h1>
          <p className="hero-text">
            Это тестовая главная страница.
          </p>

          <div className="hero-actions">
            <a className="btn" href="#widgets">Виджеты</a>
            <a className="btn secondary" href="#places">Заведения</a>
            <a className="btn secondary" href="#routes">Маршруты</a>
            <a className="btn secondary" href="#news">Афиша / Статьи</a>
          </div>
        </section>

        <section id="widgets" className="section">
          <h2 className="section-title">Виджеты</h2>

          <div className="grid">
            <WeatherWidget />

            <Widget title="Пробки">
              <div className="big">{traffic.level}</div>
              <div className="small">{traffic.note}</div>
            </Widget>

            <Widget title="Такси">
              <div className="big">{taxi.price}</div>
              <div className="small">Подача: {taxi.eta}</div>
            </Widget>

            <Widget title="Карта / Маршруты">
              <div className="small">
                Тут будет карта (2GIS / Yandex / OSM) и построение маршрутов.
              </div>
              <button className="btn secondary" style={{ marginTop: 10 }}>
                Открыть карту (заглушка)
              </button>
            </Widget>
          </div>
        </section>

        <section id="places" className="section">
          <h2 className="section-title">Заведения</h2>
          <div className="block">
            <p className="small">
              Здесь будет агрегатор заведений + отзывы.
            </p>

            <div className="list">
              <div className="list-item">
                <div>
                  <b>Кофейня “Город”</b>
                  <div className="small muted">Рейтинг: 4.6 • 128 отзывов</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>

              <div className="list-item">
                <div>
                  <b>Фитнес “Pulse”</b>
                  <div className="small muted">Рейтинг: 4.3 • 54 отзыва</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>

              <div className="list-item">
                <div>
                  <b>Кинотеатр “Central”</b>
                  <div className="small muted">Рейтинг: 4.7 • 302 отзыва</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>
            </div>
          </div>
        </section>

        <section id="routes" className="section">
          <h2 className="section-title">Маршруты по городу</h2>
          <div className="block">
            <p className="small">
              Здесь будут готовые маршруты: прогулки, туристические места.
            </p>

            <div className="list">
              <div className="list-item">
                <div>
                  <b>Маршрут: Центр за 2 часа</b>
                  <div className="small muted">8 точек • пешком • 2.1 км</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>

              <div className="list-item">
                <div>
                  <b>Маршрут: Кофе + Парк</b>
                  <div className="small muted">4 точки • пешком • 1.4 км</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>
            </div>
          </div>
        </section>

        <section id="news" className="section">
          <h2 className="section-title">Афиша / Статьи</h2>
          <div className="block">
            <p className="small">
              Здесь будет афиша мероприятий и статьи.
            </p>

            <div className="list">
              <div className="list-item">
                <div>
                  <b>Концерт в парке (сегодня)</b>
                  <div className="small muted">19:00 • Центральный парк</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>

              <div className="list-item">
                <div>
                  <b>Гайд: 10 мест где вкусно поесть</b>
                  <div className="small muted">статья • 5 мин чтения</div>
                </div>
                <button className="btn smallbtn secondary">Открыть</button>
              </div>
            </div>
          </div>
        </section>

        <footer className="footer" style={{ marginTop: 24 }}>
          <span>© CityPortal</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<CityPortalHome />);