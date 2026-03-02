const { useEffect, useState, useRef, useCallback } = React;

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
          <div className="topbar-subtitle">Такси — Оренбург</div>
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

function AddressInput({ label, color, value, onChange, onSelect, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (val) => {
    onChange(val);
    clearTimeout(debounceRef.current);
    if (val.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `/api/maps/geocode?q=${encodeURIComponent("Оренбург, " + val)}`;
        const res = await fetch(url, { credentials: "same-origin" });
        const json = await res.json();
        const items = json?.response?.GeoObjectCollection?.featureMember ?? [];
        const parsed = items.slice(0, 5).map(f => {
          const geo = f.GeoObject;
          const pos = geo.Point.pos.split(" ");
          return {
            name: geo.name,
            full: geo.metaDataProperty?.GeocoderMetaData?.text || geo.name,
            lon: parseFloat(pos[0]),
            lat: parseFloat(pos[1])
          };
        });
        setSuggestions(parsed);
        setOpen(parsed.length > 0);
      } catch (e) { console.error("Geocode error:", e); setSuggestions([]); setOpen(false); }
    }, 350);
  };

  const handleSelect = (item) => {
    onChange(item.full);
    onSelect(item.lat, item.lon, item.full);
    setSuggestions([]);
    setOpen(false);
  };

  const dotColor = color === "green" ? "#22c55e" : "#ef4444";

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 220 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10, padding: "10px 14px" }}>
        <span style={{ color: dotColor, fontSize: 18, flexShrink: 0 }}>●</span>
        <input
          type="text"
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#fff", fontSize: 14, fontFamily: "inherit"
          }}
        />
        {value && (
          <button onClick={() => { onChange(""); onSelect(null, null, ""); setSuggestions([]); setOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 16, padding: 0 }}>✕</button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999,
          background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
        }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => handleSelect(s)} style={{
              padding: "10px 14px", cursor: "pointer", borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              transition: "background 0.1s"
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.full}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutePicker({ jsApiKey, onFromChange, onToChange, fromCoords, toCoords, onCalculate }) {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);
  const initDone = useRef(false);
  const fromMarker = useRef(null);
  const toMarker = useRef(null);
  const modeRef = useRef("from");
  const [mode, setMode] = useState("from");

  const [fromText, setFromText] = useState("");
  const [toText,   setToText]   = useState("");

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
    const map = new window.ymaps.Map("taxi-map-container", {
      center: [51.7727, 55.1039], zoom: 13,
      controls: ["zoomControl", "geolocationControl"]
    });
    mapRef.current = map;

    map.events.add("click", (e) => {
      const coords = e.get("coords");
      const lat = coords[0], lon = coords[1];

      window.ymaps.geocode(coords).then(res => {
        const first = res.geoObjects.get(0);
        const address = first ? first.getAddressLine() : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        if (modeRef.current === "from") {
          setFromText(address);
          placeMarker("from", coords, map);
          onFromChange(lat, lon);
        } else {
          setToText(address);
          placeMarker("to", coords, map);
          onToChange(lat, lon);
        }
      });
    });
  }, [mapReady]);

  function placeMarker(type, coords, map) {
    if (!map) return;
    if (type === "from") {
      if (fromMarker.current) map.geoObjects.remove(fromMarker.current);
      fromMarker.current = new window.ymaps.Placemark(coords,
        { balloonContent: "Откуда", hintContent: "Точка отправления" },
        { preset: "islands#greenDotIconWithCaption", iconCaption: "Откуда" }
      );
      map.geoObjects.add(fromMarker.current);
    } else {
      if (toMarker.current) map.geoObjects.remove(toMarker.current);
      toMarker.current = new window.ymaps.Placemark(coords,
        { balloonContent: "Куда", hintContent: "Точка назначения" },
        { preset: "islands#redDotIconWithCaption", iconCaption: "Куда" }
      );
      map.geoObjects.add(toMarker.current);
    }
  }

  const handleFromSelect = useCallback((lat, lon, text) => {
    if (lat == null) { onFromChange(null, null); return; }
    onFromChange(lat, lon);
    if (mapRef.current && window.ymaps) {
      placeMarker("from", [lat, lon], mapRef.current);
      mapRef.current.panTo([lat, lon], { duration: 400 });
    }
  }, []);

  const handleToSelect = useCallback((lat, lon, text) => {
    if (lat == null) { onToChange(null, null); return; }
    onToChange(lat, lon);
    if (mapRef.current && window.ymaps) {
      placeMarker("to", [lat, lon], mapRef.current);
    }
  }, []);

  const switchMode = (m) => { modeRef.current = m; setMode(m); };

  return (
    <section className="section">
      <h2 className="section-title">🗺️ Маршрут</h2>
      <div className="block">

        {/* Адресные поля */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <AddressInput
            label="Откуда"
            color="green"
            value={fromText}
            onChange={setFromText}
            onSelect={handleFromSelect}
            placeholder="Откуда — введите адрес или кликните на карте"
          />
          <AddressInput
            label="Куда"
            color="red"
            value={toText}
            onChange={setToText}
            onSelect={handleToSelect}
            placeholder="Куда — введите адрес или кликните на карте"
          />
        </div>

        {/* Кнопки режима клика по карте */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className="small muted">Или кликните на карте:</span>
          <button
            className={`btn smallbtn${mode === "from" ? "" : " secondary"}`}
            style={{ marginTop: 0 }}
            onClick={() => switchMode("from")}
          >🟢 Откуда</button>
          <button
            className={`btn smallbtn${mode === "to" ? "" : " secondary"}`}
            style={{ marginTop: 0 }}
            onClick={() => switchMode("to")}
          >🔴 Куда</button>
          <span className="small muted" style={{ marginLeft: 4 }}>
            режим: <b style={{ color: mode === "from" ? "#22c55e" : "#ef4444" }}>{mode === "from" ? "Откуда" : "Куда"}</b>
          </span>
        </div>

        {mapError && <div className="msg err">{mapError}</div>}
        {!mapReady && !mapError && <div className="small muted" style={{ padding: "20px 0" }}>Загрузка карты…</div>}
        <div
          id="taxi-map-container"
          style={{
            width: "100%", height: "360px", borderRadius: 12, overflow: "hidden",
            display: mapReady ? "block" : "none",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            cursor: "crosshair"
          }}
        />

        {/* Кнопка расчёта прямо здесь */}
        <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn"
            style={{ marginTop: 0, opacity: (fromCoords && toCoords) ? 1 : 0.5, cursor: (fromCoords && toCoords) ? "pointer" : "not-allowed" }}
            disabled={!(fromCoords && toCoords)}
            onClick={onCalculate}
          >
            Рассчитать стоимость
          </button>
          {!(fromCoords && toCoords) && (
            <span className="small muted">Укажите оба адреса</span>
          )}
        </div>
      </div>
    </section>
  );
}

function TaxiOptionCard({ opt }) {
  const isAvailable = opt.available !== false;

  const cardStyle = {
    display: "flex", alignItems: "center", gap: 16,
    padding: "16px 20px",
    background: isAvailable ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.012)",
    border: `1px solid ${isAvailable ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)"}`,
    borderRadius: 14, color: "inherit",
    opacity: isAvailable ? 1 : 0.5,
    cursor: "default"
  };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: "2.2rem", flexShrink: 0, lineHeight: 1, filter: isAvailable ? "none" : "grayscale(1)" }}>
        {opt.icon || "🚕"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
          {opt.className || opt.classId}
          {!isAvailable && (
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
              background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20, padding: "1px 7px"
            }}>Недоступно</span>
          )}
        </div>
        <div className="small muted" style={{ marginTop: 3 }}>{opt.description}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {opt.minPrice != null ? (
          <>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fbbf24" }}>
              {opt.minPrice === opt.maxPrice ? `~${opt.minPrice} ₽` : `~${opt.minPrice}–${opt.maxPrice} ₽`}
            </div>
            {opt.waitingTimeMinutes != null && (
              <div className="small muted">подача {opt.waitingTimeMinutes} мин</div>
            )}
          </>
        ) : (
          <div className="small muted">—</div>
        )}
      </div>
    </div>
  );
}

function OptionsBlock({ data, loading, error }) {
  if (loading) return (
    <div className="block" style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🚕</div>
      <span className="muted">Запрос к Яндекс GO…</span>
    </div>
  );

  if (error) return <div className="msg err">{error}</div>;
  if (!data) return null;

  if (data.status === "unavailable" || !data.options || data.options.length === 0) {
    return (
      <div className="block" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>😔</div>
        <div className="small muted">Нет доступных тарифов для данного маршрута.</div>
        {data.deepLink && (
          <a href={data.deepLink} target="_blank" rel="noopener noreferrer"
             className="btn" style={{ marginTop: 16, display: "inline-block" }}>
            Открыть Яндекс GO →
          </a>
        )}
      </div>
    );
  }

  return (
    <section className="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>🚖 Тарифы</h2>
          <span style={{
            fontSize: 12, fontWeight: 600,
            background: "rgba(251,191,36,0.12)", color: "#fbbf24",
            border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: 20, padding: "2px 10px"
          }}>
            {data.options.filter(o => o.available !== false).length} из {data.options.length} доступно
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.options.map((opt, i) => (
          <TaxiOptionCard key={i} opt={opt} deepLink={data.deepLink} clid={data.clid} />
        ))}
      </div>

      {/* Кнопка перехода в Яндекс GO */}
      {data.deepLink && (
        <a
          href={data.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            marginTop: 16, padding: "14px 20px",
            background: "linear-gradient(135deg, #fc0, #ff8c00)",
            borderRadius: 14, textDecoration: "none", color: "#1a1a1a",
            fontWeight: 700, fontSize: 15,
            boxShadow: "0 4px 20px rgba(255,200,0,0.25)",
            transition: "opacity 0.15s, transform 0.15s"
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <span>Заказать в Яндекс GO</span>
        </a>
      )}

      <div className="small muted" style={{ marginTop: 10, textAlign: "right" }}>
        Данные предоставлены Яндекс GO
      </div>
    </section>
  );
}

function HeroSummary({ data }) {
  if (!data) return null;
  const cheapest = data.options?.filter(o => o.minPrice != null && o.available !== false)
    .sort((a, b) => a.minPrice - b.minPrice)[0];
  const availableCount = data.options?.filter(o => o.available !== false).length ?? 0;
  const available = data.status === "available" && availableCount > 0;

  return (
    <div className="weather-detail-hero" style={{ alignItems: "flex-start", gap: 28, marginBottom: 0 }}>
      <div className="weather-detail-hero-left" style={{ gap: 22 }}>
        <span style={{ fontSize: "4.5rem", lineHeight: 1 }}>🚕</span>
        <div>
          <div className="weather-detail-temp" style={{ color: "#fbbf24", fontSize: "2.6rem", lineHeight: 1 }}>
            {available && cheapest ? `~${cheapest.minPrice} ₽` : "Нет данных"}
          </div>
          <div className="weather-detail-desc" style={{ marginTop: 6 }}>
            {available ? `${availableCount} тарифов доступно` : "Сервис недоступен"}
          </div>
          <div className="small muted" style={{ marginTop: 10 }}>
            {data.updatedAt ? `Обновлено: ${new Date(data.updatedAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
          </div>
        </div>
      </div>
      <div className="weather-detail-hero-right">
        <div className="weather-detail-city">{data.city || "Оренбург"}</div>
        {cheapest && (
          <div style={{ marginTop: 16 }}>
            <div className="small muted">Самый дешёвый тариф:</div>
            <div style={{ fontWeight: 700, marginTop: 4, fontSize: 15 }}>
              {cheapest.icon} {cheapest.className} — {cheapest.minPrice} ₽
            </div>
            {cheapest.waitingTimeMinutes != null && (
              <div className="small muted" style={{ marginTop: 4 }}>Подача: {cheapest.waitingTimeMinutes} мин</div>
            )}
          </div>
        )}
        {data.deepLink && (
          <a href={data.deepLink} target="_blank" rel="noopener noreferrer"
             className="btn" style={{ marginTop: 18, display: "inline-block" }}>
            Заказать такси →
          </a>
        )}
      </div>
    </div>
  );
}

function TaxiPage() {
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords,   setToCoords]   = useState(null);
  const [jsApiKey,   setJsApiKey]   = useState(null);
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [queried,    setQueried]    = useState(false);

  useEffect(() => {
    fetch("/api/maps/js-key")
      .then(r => r.ok ? r.text() : null)
      .then(k => k && setJsApiKey(k))
      .catch(() => {});
  }, []);

  const handleFromChange = useCallback((lat, lon) => {
    setFromCoords(lat != null ? [lat, lon] : null);
  }, []);
  const handleToChange = useCallback((lat, lon) => {
    setToCoords(lat != null ? [lat, lon] : null);
  }, []);

  const loadDetails = useCallback(async (fc, tc) => {
    const from = fc || fromCoords;
    const to   = tc || toCoords;
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setQueried(true);
    try {
      const url = `/api/taxi/details?fromLat=${from[0]}&fromLon=${from[1]}&toLat=${to[0]}&toLon=${to[1]}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fromCoords, toCoords]);

  return (
    <div className="home">
      <TopBar />
      <main className="main">

        {/* Route picker с поиском и картой */}
        {jsApiKey && (
          <RoutePicker
            jsApiKey={jsApiKey}
            fromCoords={fromCoords}
            toCoords={toCoords}
            onFromChange={handleFromChange}
            onToChange={handleToChange}
            onCalculate={() => loadDetails()}
          />
        )}

        {/* Loader / Results */}
        {loading && (
          <div className="block" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🚕</div>
            <span className="muted">Запрос к Яндекс GO…</span>
          </div>
        )}
        {queried && !loading && <OptionsBlock data={data} loading={false} error={error} />}

        <footer className="footer" style={{ marginTop: 32 }}>
          <span>© CityPortal &nbsp;|&nbsp; Такси предоставлены Яндекс GO</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<TaxiPage />);