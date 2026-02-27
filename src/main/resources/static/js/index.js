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

function MapWidget() {
  const [mapReady, setMapReady]       = useState(false);
  const [mapError, setMapError]       = useState(null);
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState([]);
  const [searching, setSearching]     = useState(false);
  const [searchError, setSearchError] = useState(null);

  const mapRef      = React.useRef(null);
  const initDone    = React.useRef(false);
  const markerRef   = React.useRef(null);
  const debounceRef = React.useRef(null);

  useEffect(() => {
    if (window._ymapsLoaded) {
      window.ymaps.ready(() => setMapReady(true));
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/maps/js-key");
        if (!res.ok) throw new Error("Не удалось получить ключ карты");
        const key = await res.text();
        const script = document.createElement("script");
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
        script.async = true;
        script.onload = () => {
          window._ymapsLoaded = true;
          window.ymaps.ready(() => setMapReady(true));
        };
        script.onerror = () => setMapError("Не удалось загрузить Яндекс Карты");
        document.head.appendChild(script);
      } catch (e) {
        setMapError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!mapReady || initDone.current) return;
    initDone.current = true;
    mapRef.current = new window.ymaps.Map("ymap-widget-container", {
      center: [51.7727, 55.1039],
      zoom: 12,
      controls: ["zoomControl", "geolocationControl"]
    });
  }, [mapReady]);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Ошибка геокодера");
      const data = await res.json();
      const members = data?.response?.GeoObjectCollection?.featureMember ?? [];
      const mapped = members.map(m => {
        const obj = m.GeoObject;
        const pos = obj.Point.pos.split(" ").map(Number);
        return { name: obj.metaDataProperty?.GeocoderMetaData?.text ?? "Без названия", coords: [pos[1], pos[0]] };
      });
      setResults(mapped.filter(r => r.name.toLowerCase().includes("оренбург")));
    } catch (e) {
      setSearchError(e.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleSelect = (item) => {
    setQuery(item.name);
    setResults([]);
    if (!mapRef.current) return;
    if (markerRef.current) mapRef.current.geoObjects.remove(markerRef.current);
    markerRef.current = new window.ymaps.Placemark(item.coords, { balloonContent: item.name }, { preset: "islands#redDotIcon" });
    mapRef.current.geoObjects.add(markerRef.current);
    mapRef.current.setCenter(item.coords, 15, { duration: 500 });
    markerRef.current.balloon.open();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    doSearch(query);
  };

  return (
    <div className="widget map-widget">
      <div className="widget-title">🗺️ Карта города</div>
      <div className="widget-body">

        {/* Геокодер */}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6, marginBottom: 10, position: "relative" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              className="input"
              placeholder="Найти место на карте..."
              value={query}
              onChange={handleInput}
              autoComplete="off"
              style={{ padding: "8px 10px", fontSize: 13 }}
            />
            {results.length > 0 && (
              <ul style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                background: "rgba(11,18,32,0.97)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, margin: 0, padding: 0, listStyle: "none",
                zIndex: 200, maxHeight: 200, overflowY: "auto",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
              }}>
                {results.map((r, i) => (
                  <li key={i} onClick={() => handleSelect(r)} style={{
                    padding: "8px 12px", cursor: "pointer", fontSize: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    color: "var(--text)"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >{r.name}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="btn smallbtn" disabled={searching} style={{ marginTop: 0, padding: "8px 12px", fontSize: 12 }}>
            {searching ? "..." : "🔍"}
          </button>
        </form>
        {searchError && <div className="small" style={{ color: "var(--danger)", marginBottom: 6 }}>{searchError}</div>}

        {mapError && (
          <div className="small" style={{ color: "var(--danger)", marginBottom: 6 }}>{mapError}</div>
        )}
        {!mapReady && !mapError && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <span className="small muted">Загрузка карты...</span>
          </div>
        )}

        <div
          id="ymap-widget-container"
          style={{
            width: "100%",
            height: "260px",
            borderRadius: 10,
            overflow: "hidden",
            display: mapReady ? "block" : "none",
            border: "1px solid rgba(255,255,255,0.10)"
          }}
        />

        <div style={{ marginTop: 8, textAlign: "right" }}>
          <a className="btn smallbtn secondary" href="/map" style={{ display: "inline-block" }}>
            Открыть карту →
          </a>
        </div>
      </div>
    </div>
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

          </p>

          <div className="hero-actions">
            <a className="btn" href="#widgets">Виджеты</a>
            <a className="btn secondary" href="#places">Заведения</a>
            <a className="btn secondary" href="/map">Карта</a>
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

            <MapWidget />
          </div>
        </section>

        <section id="places" className="section">
          <h2 className="section-title">Заведения</h2>
          <div className="block">
            <p className="small">

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