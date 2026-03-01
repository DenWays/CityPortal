const { useEffect, useState, useRef } = React;

/* ── helpers ─────────────────────────────────────────── */
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

/* ── auth topbar ─────────────────────────────────────── */
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

/* ── yandex map with traffic layer ──────────────────────*/
function TrafficMap({ jsApiKey, lat, lon }) {
  const [mapReady, setMapReady]   = useState(false);
  const [mapError, setMapError]   = useState(null);
  const [trafficOn, setTrafficOn] = useState(true);
  const mapRef     = useRef(null);
  const initDone   = useRef(false);
  const trafficRef = useRef(null);

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

/* ── segments ────────────────────────────────────────── */
function SegmentsTable({ segments }) {
  if (!segments || segments.length === 0) return null;
  return (
    <section className="section">
      <h2 className="section-title">🛣️ Загруженность участков</h2>
      <div className="block" style={{ padding: 0, overflow: "hidden" }}>
        {segments.map((seg, i) => {
          const color = seg.color || levelColor(seg.level);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 18px",
              borderBottom: i < segments.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              transition: "background 0.15s", cursor: "default"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
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
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── legend ──────────────────────────────────────────── */
function Legend() {
  const items = [
    { range: "1–2",  color: "#22c55e", label: "Свободно — движение без задержек" },
    { range: "3–4",  color: "#84cc16", label: "Небольшие пробки — незначительные задержки" },
    { range: "5–6",  color: "#f59e0b", label: "Умеренные пробки — задержки на отдельных участках" },
    { range: "7–8",  color: "#ef4444", label: "Сложная обстановка — значительные задержки" },
    { range: "9–10", color: "#7f1d1d", label: "Большие пробки — движение очень затруднено" },
  ];
  return (
    <section className="section">
      <h2 className="section-title">📊 Шкала загруженности</h2>
      <div className="block">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(it => (
            <div key={it.range} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 22, borderRadius: 7, background: it.color, flexShrink: 0, boxShadow: `0 0 8px ${it.color}55` }} />
              <div style={{ fontWeight: 700, fontSize: 13, width: 38, flexShrink: 0, color: it.color }}>{it.range}</div>
              <div className="small" style={{ color: "var(--text)" }}>{it.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── rush hours ──────────────────────────────────────── */
function RushHours() {
  const hours = [
    { time: "07:30 – 09:30", icon: "🌅", label: "Утренний час пик",  color: "#ef4444" },
    { time: "12:00 – 13:30", icon: "☀️", label: "Обеденное время",   color: "#f59e0b" },
    { time: "17:00 – 19:30", icon: "🌆", label: "Вечерний час пик",  color: "#ef4444" },
  ];
  return (
    <section className="section">
      <h2 className="section-title">⏰ Часы пик в Оренбурге</h2>
      <div className="block">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {hours.map(h => (
            <div key={h.time} style={{
              flex: "1 1 180px",
              background: `${h.color}11`, border: `1px solid ${h.color}33`,
              borderRadius: 12, padding: "16px", textAlign: "center"
            }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>{h.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: h.color }}>{h.time}</div>
              <div className="small muted" style={{ marginTop: 4 }}>{h.label}</div>
            </div>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 14 }}>
          Рекомендуем планировать поездки вне часов пик для экономии времени.
        </div>
      </div>
    </section>
  );
}

/* ── main ────────────────────────────────────────────── */
function TrafficPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

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
            <TrafficMap jsApiKey={data.jsApiKey} lat={data.lat} lon={data.lon} />

            {/* ── Segments ── */}
            <SegmentsTable segments={data.segments} />

            {/* ── Legend ── */}
            <Legend />

            {/* ── Rush hours ── */}
            <RushHours />
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