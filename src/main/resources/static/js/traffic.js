const { useEffect, useState, useRef } = React;

const LEVEL_COLORS = [
  "#6b7280","#22c55e","#22c55e","#84cc16","#84cc16",
  "#f59e0b","#f59e0b","#ef4444","#ef4444","#dc2626","#7f1d1d"
];

function levelColor(level) {
  return LEVEL_COLORS[Math.max(0, Math.min(10, level))] || "#6b7280";
}

function LevelBar({ level }) {
  const color = levelColor(level);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap" }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{
          width: 20, height: 20, borderRadius: 5,
          background: i < level ? color : "rgba(255,255,255,0.08)",
          boxShadow: i < level ? `0 0 6px ${color}66` : "none",
          transition: "background 0.3s"
        }} />
      ))}
      <span style={{ marginLeft: 10, fontWeight: 800, fontSize: 20, color }}>{level}/10</span>
    </div>
  );
}

function formatUpdated(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function TopBar() {
  const [account, setAccount] = useState(null);

  useEffect(() => {
    fetch("/api/auth/account", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setAccount(d))
      .catch(() => {});
  }, []);

  async function logout() {
    try {
      const r = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
      const { token } = await r.json();
      await fetch("/logout", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-CSRF-TOKEN": token },
        body: new URLSearchParams({ _csrf: token }).toString()
      });
    } catch (_) {}
    window.location.href = "/login?logout";
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo small" />
        <div>
          <div className="topbar-title">CityPortal</div>
          <div className="topbar-subtitle">Пробки — Оренбург</div>
        </div>
      </div>
      <div className="topbar-right">
        {account ? (
          <>
            <span className="small">Вы вошли как: <b>{account.login}</b></span>
            <a className="btn smallbtn secondary" href="/profile">Профиль</a>
            <button className="btn smallbtn secondary" onClick={logout}>Выйти</button>
          </>
        ) : (
          <>
            <a className="btn smallbtn secondary" href="/login">Войти</a>
            <a className="btn smallbtn" href="/register">Регистрация</a>
          </>
        )}
        <a className="btn smallbtn secondary" href="/" style={{ marginLeft: 6 }}>← На главную</a>
      </div>
    </header>
  );
}

function TrafficMap({ jsApiKey, lat, lon, selectedStreet }) {
  const [mapReady, setMapReady]     = useState(false);
  const [mapError, setMapError]     = useState(null);
  const [trafficOn, setTrafficOn]   = useState(true);
  const [streetLabel, setStreetLabel] = useState(null);
  const mapRef        = useRef(null);
  const initDone      = useRef(false);
  const trafficRef    = useRef(null);
  const streetMarkRef = useRef(null);

  useEffect(() => {
    if (!jsApiKey) return;
    if (window._ymapsLoaded) { window.ymaps.ready(() => setMapReady(true)); return; }
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${jsApiKey}&lang=ru_RU`;
    s.async = true;
    s.onload = () => { window._ymapsLoaded = true; window.ymaps.ready(() => setMapReady(true)); };
    s.onerror = () => setMapError("Не удалось загрузить Яндекс Карты");
    document.head.appendChild(s);
  }, [jsApiKey]);

  useEffect(() => {
    if (!mapReady || initDone.current) return;
    initDone.current = true;
    const map = new window.ymaps.Map("traffic-map-container", {
      center: [lat, lon], zoom: 13,
      controls: ["zoomControl", "fullscreenControl", "geolocationControl", "typeSelector"]
    });
    mapRef.current = map;
    const tc = new window.ymaps.control.TrafficControl({ shown: true });
    map.controls.add(tc);
    tc.getProvider("traffic#actual").setMap(map);
    trafficRef.current = tc;
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady || !selectedStreet) return;
    const map = mapRef.current;
    if (streetMarkRef.current) { map.geoObjects.remove(streetMarkRef.current); streetMarkRef.current = null; }
    const query = `Оренбург, ${selectedStreet}`;
    window.ymaps.geocode(query, { results: 1 }).then(res => {
      const obj = res.geoObjects.get(0);
      if (!obj) return;
      const coords = obj.geometry.getCoordinates();
      map.setCenter(coords, 15, { duration: 400 });
      const placemark = new window.ymaps.Placemark(coords, {
        balloonContent: selectedStreet,
        hintContent: selectedStreet
      }, {
        preset: "islands#redDotIconWithCaption",
        iconCaptionMaxWidth: "200"
      });
      map.geoObjects.add(placemark);
      streetMarkRef.current = placemark;
      setStreetLabel(selectedStreet);
    });
  }, [mapReady, selectedStreet]);

  const toggleTraffic = () => {
    if (!trafficRef.current) return;
    const p = trafficRef.current.getProvider("traffic#actual");
    trafficOn ? p.setMap(null) : p.setMap(mapRef.current);
    setTrafficOn(v => !v);
  };

  return (
    <section className="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>🗺️ Карта пробок</h2>
        <button className="btn smallbtn secondary" onClick={toggleTraffic} disabled={!mapReady} style={{ marginTop: 0 }}>
          {trafficOn ? "🚫 Скрыть пробки" : "🚦 Показать пробки"}
        </button>
      </div>
      {streetLabel && (
        <div style={{
          marginBottom: 10, padding: "10px 16px",
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)",
          borderRadius: 10, display: "flex", alignItems: "center", gap: 10
        }}>
          <span style={{ fontSize: "1.1rem" }}>📍</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#ef4444" }}>На карте: </span>
          <span style={{ fontSize: 14 }}>{streetLabel}</span>
          <button
            onClick={() => {
              if (streetMarkRef.current) { mapRef.current.geoObjects.remove(streetMarkRef.current); streetMarkRef.current = null; }
              setStreetLabel(null);
            }}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 16 }}
          >✕</button>
        </div>
      )}
      {mapError && <div className="msg err">{mapError}</div>}
      {!mapReady && !mapError && (
        <div className="block" style={{ textAlign: "center", padding: 32 }}>
          <span className="muted">Загрузка карты…</span>
        </div>
      )}
      <div id="traffic-map-container" style={{
        width: "100%", height: "500px", borderRadius: 14, overflow: "hidden",
        display: mapReady ? "block" : "none",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)"
      }} />
      <div className="small muted" style={{ marginTop: 8, textAlign: "right" }}>
        Слой пробок — Яндекс Карты &nbsp;|&nbsp; Данные — TomTom Traffic API
      </div>
    </section>
  );
}

function SegmentsTable({ segments, onStreetClick }) {
  if (!segments || segments.length === 0) return null;
  return (
    <section className="section">
      <h2 className="section-title">🛣️ Загруженность участков</h2>
      <div className="small muted" style={{ marginBottom: 8 }}>Нажмите на улицу, чтобы показать её на карте</div>
      <div className="block" style={{ padding: 0, overflow: "hidden" }}>
        {segments.map((seg, i) => {
          const color = seg.color || levelColor(seg.level);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 18px",
              borderBottom: i < segments.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              transition: "background 0.15s", cursor: "pointer"
            }}
            onClick={() => onStreetClick && onStreetClick(seg.name)}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
                background: color, boxShadow: `0 0 8px ${color}`
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{seg.name}</div>
                <div className="small muted">{seg.description}</div>
              </div>
              <div style={{ color, fontWeight: 800, fontSize: 15, flexShrink: 0, minWidth: 36, textAlign: "right" }}>
                {seg.level}/10
              </div>
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                {Array.from({ length: 5 }, (_, j) => (
                  <div key={j} style={{
                    width: 7, height: 16, borderRadius: 3,
                    background: j * 2 < seg.level ? color : "rgba(255,255,255,0.08)"
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>📍</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrafficPage() {
  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedStreet, setSelectedStreet] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/traffic/details");
      if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const color = data ? (data.color || levelColor(data.level)) : "#6b7280";

  return (
    <div className="home">
      <TopBar />
      <main className="main">

        {/* top action row */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button className="btn smallbtn secondary" onClick={load} disabled={loading} style={{ marginTop: 0 }}>
            {loading ? "⏳ Обновление…" : "🔄 Обновить"}
          </button>
        </div>

        {/* loading skeleton */}
        {loading && !data && (
          <div className="block" style={{ textAlign: "center", padding: 56 }}>
            <div style={{ fontSize: "3rem", marginBottom: 14 }}>🚦</div>
            <span className="muted">Загрузка данных о пробках…</span>
          </div>
        )}

        {error && <div className="msg err" style={{ marginTop: 18 }}>{error}</div>}

        {data && (
          <>
            {/* ── Hero ── */}
            <div className="weather-detail-hero" style={{ alignItems: "flex-start", gap: 28 }}>
              <div className="weather-detail-hero-left" style={{ gap: 22 }}>
                <span style={{ fontSize: "4.5rem", lineHeight: 1 }}>🚦</span>
                <div>
                  <div className="weather-detail-temp" style={{ color, fontSize: "3rem", lineHeight: 1 }}>
                    {data.level}/10
                  </div>
                  <div className="weather-detail-desc" style={{ marginTop: 6 }}>{data.description}</div>
                  <div className="small muted" style={{ marginTop: 10 }}>
                    Обновлено: {formatUpdated(data.updatedAt)}
                  </div>
                </div>
              </div>
              <div className="weather-detail-hero-right">
                <div className="weather-detail-city">{data.city}</div>
                <div style={{ marginTop: 16 }}>
                  <LevelBar level={data.level} />
                </div>
                <div className="small muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
                  {data.trend}
                </div>
              </div>
            </div>

            {/* ── Advice banner ── */}
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="block" style={{
                display: "flex", alignItems: "center", gap: 16,
                background: `${color}18`, border: `1px solid ${color}44`,
                borderRadius: 14, padding: "16px 20px"
              }}>
                <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>💡</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color, marginBottom: 3 }}>Рекомендация</div>
                  <div className="small" style={{ color: "var(--text)" }}>{data.advice}</div>
                </div>
              </div>
            </section>

            {/* ── Map ── */}
            <TrafficMap jsApiKey={data.jsApiKey} lat={data.lat} lon={data.lon} selectedStreet={selectedStreet} />

            {/* ── Segments ── */}
            <SegmentsTable segments={data.segments} onStreetClick={name => { setSelectedStreet(null); setTimeout(() => setSelectedStreet(name), 0); }} />
          </>
        )}

        <footer className="footer" style={{ marginTop: 32 }}>
          <span>© CityPortal</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<TrafficPage />);