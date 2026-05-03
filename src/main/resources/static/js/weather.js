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

function formatHour(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

function formatUpdated(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function WeatherPage() {
  const [theme, setTheme] = React.useState(() => localStorage.getItem('cp-theme') || 'dark');
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cp-theme', theme);
  }, [theme]);
  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark'); }
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/weather/details");
        if (!res.ok) throw new Error("Ошибка загрузки данных погоды");
        setData(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="home">

      {/* Топбар */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo small" />
          <div>
            <div className="topbar-title">CityPortal</div>
            <div className="topbar-subtitle">Погода</div>
          </div>
        </div>
        <div className="topbar-right">
        <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} aria-label="Переключить тему">{theme === 'dark' ? '☀️' : '🌙'}</button>
          <a className="btn smallbtn secondary" href="/">← На главную</a>
        </div>
      </header>

      <main className="main">

        {loading && (
          <div className="block" style={{ textAlign: "center", padding: 40 }}>
            <span className="muted">Загрузка данных о погоде...</span>
          </div>
        )}

        {error && (
          <div className="msg err" style={{ marginTop: 18 }}>{error}</div>
        )}

        {data && (() => {
          const { current, hourly, daily } = data;
          return (
            <>
              {/* Текущая погода — hero */}
              <div className="weather-detail-hero">
                <div className="weather-detail-hero-left">
                  <WeatherIcon name={current.icon} className="weather-detail-icon" />
                  <div>
                    <div className="weather-detail-temp">{Math.round(current.tempC)}°C</div>
                    <div className="weather-detail-desc">{current.description}</div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      Ощущается как {Math.round(current.feelsLikeC)}°C
                    </div>
                  </div>
                </div>
                <div className="weather-detail-hero-right">
                  <div className="weather-detail-city">{current.city}</div>
                  <div className="small muted">Обновлено: {formatUpdated(current.updatedAt)}</div>
                </div>
              </div>

              {/* Почасовой прогноз */}
              <section className="section">
                <h2 className="section-title">Прогноз по часам</h2>
                <div className="block" style={{ padding: "10px 14px" }}>
                  <div className="weather-scroll weather-scroll-full">
                    {hourly.map((h, i) => (
                      <div key={i} className="weather-scroll-item weather-scroll-item-lg">
                        <div className="small muted">{formatHour(h.time)}</div>
                        <WeatherIcon name={h.icon} className="weather-icon-sm" />
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{Math.round(h.tempC)}°</div>
                        <div className="small muted" style={{ textAlign: "center", fontSize: 11 }}>
                          {Math.round(h.feelsLikeC)}°
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 7-дневный прогноз */}
              <section className="section">
                <h2 className="section-title">Прогноз на 7 дней</h2>
                <div className="block">
                  <div className="weather-daily">
                    {daily.map((d, i) => {
                      const range = d.maxC - d.minC || 1;
                      const pct   = Math.round(((d.maxC + d.minC) / 2 - d.minC) / range * 100);
                      return (
                        <div key={i} className="weather-daily-row weather-daily-row-lg">
                          <div className="weather-daily-day">{formatDay(d.date)}</div>
                          <WeatherIcon name={d.icon} className="weather-icon-sm" />
                          <div className="weather-daily-desc small muted">{d.description}</div>
                          <div className="weather-daily-range">
                            <span className="small muted">{Math.round(d.minC)}°</span>
                            <div className="weather-temp-bar">
                              <div className="weather-temp-bar-fill" style={{ left: "0%", right: "0%" }} />
                            </div>
                            <span className="small" style={{ fontWeight: 800 }}>{Math.round(d.maxC)}°</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </>
          );
        })()}

        <footer className="footer" style={{ marginTop: 24 }}>
          <span>© CityPortal</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<WeatherPage />);

