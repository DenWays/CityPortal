const { useEffect, useState, useCallback, useRef } = React;

function VenueMap({ latitude, longitude, name, address }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const [mapReady, setMapReady]   = useState(false);
  const [mapError, setMapError]   = useState(null);
  const initDone = useRef(false);
  const domId = useRef("venue-mini-map-" + Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!latitude || !longitude) return;
    if (window._ymapsLoaded) {
      window.ymaps.ready(() => setMapReady(true));
      return;
    }
    fetch("/api/maps/js-key")
      .then(r => r.ok ? r.text() : Promise.reject("no key"))
      .then(key => {
        if (document.querySelector(`script[src*="api-maps.yandex.ru"]`)) {
          window.ymaps && window.ymaps.ready(() => setMapReady(true));
          return;
        }
        const s = document.createElement("script");
        s.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
        s.async = true;
        s.onload = () => { window._ymapsLoaded = true; window.ymaps.ready(() => setMapReady(true)); };
        s.onerror = () => setMapError("Не удалось загрузить карту");
        document.head.appendChild(s);
      })
      .catch(() => setMapError("Не удалось получить ключ карты"));
  }, [latitude, longitude]);

  useEffect(() => {
    if (!mapReady || initDone.current || !mapContainerRef.current) return;
    initDone.current = true;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const map = new window.ymaps.Map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 16,
      controls: ["zoomControl"]
    });
    mapRef.current = map;
    const marker = new window.ymaps.Placemark(
      [lat, lon],
      { balloonContent: `<b>${name || ""}</b>${address ? "<br/>" + address : ""}`, hintContent: name || "" },
      { preset: "islands#redIcon" }
    );
    map.geoObjects.add(marker);
    marker.balloon.open();
  }, [mapReady]);

  if (!latitude || !longitude) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>📍 НА КАРТЕ</div>
      {mapError ? (
        <div style={{ padding: "12px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, fontSize: 13, color: "#f87171" }}>{mapError}</div>
      ) : (
        <div style={{ position: "relative", width: "100%", height: 280, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
          {!mapReady && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 13, zIndex: 1 }}>⏳ Загрузка карты...</div>
          )}
          <div
            ref={mapContainerRef}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}

function getVenueId() {
  const m = window.location.pathname.match(/\/venues\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function StarRating({ rating }) {
  const num = parseFloat(rating);
  if (!rating || isNaN(num)) return null;
  const full = Math.round(num);
  return (
    <span style={{ color: "#fbbf24", fontSize: 13, letterSpacing: 1 }}>
      {"\u2605".repeat(Math.min(full, 5))}{"\u2606".repeat(Math.max(0, 5 - full))}
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginLeft: 4 }}>{rating}</span>
    </span>
  );
}

function AdminBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: "2px 7px", borderRadius: 20,
      background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(96,165,250,0.2))",
      border: "1px solid rgba(167,139,250,0.45)", color: "#c4b5fd", textTransform: "uppercase"
    }}>👑 Admin</span>
  );
}

function Topbar({ title, userRole }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo small" />
        <div>
          <div className="topbar-title">CityPortal</div>
          <div className="topbar-subtitle">{title || "Заведения"}</div>
        </div>
      </div>
      <div className="topbar-right">
        {userRole === "ROLE_ADMIN" && <AdminBadge />}
        <a className="btn smallbtn secondary" href="/">&larr; На главную</a>
      </div>
    </header>
  );
}

function useUserRole() {
  const [userRole, setUserRole] = useState(null);
  useEffect(() => {
    fetch("/api/auth/account", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.role && data.role.name) setUserRole(data.role.name);
        else setUserRole(false);
      })
      .catch(() => setUserRole(false));
  }, []);
  return userRole;
}

function CategoryMultiSelect({ categories, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(cat) {
    if (selected.includes(cat)) onChange(selected.filter(c => c !== cat));
    else onChange([...selected, cat]);
  }

  const hasSelected = selected.length > 0;
  const buttonLabel = !hasSelected ? "Все категории"
    : selected.length === 1 ? selected[0]
    : `Выбрано: ${selected.length}`;

  if (categories.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "9px 14px", borderRadius: 10, cursor: "pointer",
          border: hasSelected ? "1px solid rgba(96,165,250,0.70)" : "1px solid rgba(255,255,255,0.18)",
          background: hasSelected ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.07)",
          color: "rgba(255,255,255,0.92)", fontSize: 14,
          fontFamily: "inherit", fontWeight: hasSelected ? 700 : 400,
          whiteSpace: "nowrap", userSelect: "none",
          transition: "border-color 0.15s, background 0.15s"
        }}
      >
        <span>🗂 {buttonLabel}</span>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
          style={{ opacity: 0.55, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", zIndex: 300, top: "calc(100% + 8px)", left: 0,
          background: "#0f1623", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.60), 0 0 0 1px rgba(96,165,250,0.08)",
          padding: "8px", minWidth: 240, maxHeight: 320, overflowY: "auto"
        }}>
          {categories.map(cat => {
            const isActive = selected.includes(cat);
            return (
              <div
                key={cat}
                onClick={() => toggle(cat)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                  background: isActive ? "rgba(96,165,250,0.15)" : "transparent",
                  transition: "background 0.12s", userSelect: "none"
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isActive ? "rgba(96,165,250,0.15)" : "transparent"; }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: isActive ? "2px solid rgba(96,165,250,0.90)" : "2px solid rgba(255,255,255,0.25)",
                  background: isActive ? "rgba(96,165,250,0.80)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.12s"
                }}>
                  {isActive && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 13, color: isActive ? "#93c5fd" : "rgba(255,255,255,0.80)" }}>{cat}</span>
              </div>
            );
          })}
          {hasSelected && (
            <div
              onClick={() => { onChange([]); setOpen(false); }}
              style={{
                marginTop: 4, padding: "7px 12px", borderRadius: 10, cursor: "pointer",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.40)", fontSize: 12, textAlign: "center", userSelect: "none"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              ✕ Сбросить выбор
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VenueDetail({ id }) {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showReviews, setShowReviews] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeMsg, setSummarizeMsg] = useState(null);
  const userRole = useUserRole();
  const isAdmin = userRole === "ROLE_ADMIN";

  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetch(`/api/venue/${id}`)
      .then(r => { if (!r.ok) throw new Error("Заведение не найдено"); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    if (!data) return;
    setRefreshing(true);
    const params = new URLSearchParams({ name: data.name || "", address: data.address || "", lat: data.latitude, lon: data.longitude });
    try { const r = await fetch(`/api/venue/refresh?${params}`, { method: "POST" }); setData(await r.json()); } catch (_) {}
    setRefreshing(false);
  }

  async function handleSummarize() {
    setSummarizing(true); setSummarizeMsg(null);
    try {
      const r = await fetch(`/api/venue/${id}/summarize`, { method: "POST" });
      const d = await r.json();
      if (d.status === "ok") { setData(prev => ({ ...prev, reviewsSummary: d.summary })); setSummarizeMsg({ ok: true, text: "Суммаризация выполнена успешно!" }); }
      else setSummarizeMsg({ ok: false, text: d.message || "Не удалось выполнить суммаризацию." });
    } catch (_) { setSummarizeMsg({ ok: false, text: "Ошибка при запросе суммаризации." }); }
    setSummarizing(false);
  }

  const row = { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 };
  const lbl = { fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, minWidth: 80, paddingTop: 2 };
  const val = { fontSize: 14, color: "rgba(255,255,255,0.88)", flex: 1, lineHeight: 1.6 };

  return (
    <div className="home">
      <Topbar title="Заведения" userRole={userRole} />
      <main className="main">
        <section className="section">
          <div style={{ marginBottom: 12 }}>
            <a href="/venues" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}>← Все заведения</a>
          </div>
          {loading && <div className="block" style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>⏳ Загрузка...</div>}
          {error && <div className="block" style={{ color: "#f87171", padding: 24 }}>{error}</div>}
          {!loading && !error && data && (
            <div className="block">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>{data.name}</h2>
                  {data.category && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{data.category}</div>}
                  {data.rating && <div style={{ marginTop: 6 }}><StarRating rating={data.rating} /></div>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {data.yandexUrl && <a href={data.yandexUrl} target="_blank" rel="noreferrer" className="btn smallbtn secondary" style={{ marginTop: 0 }}>🗺 Яндекс Карты ↗</a>}
                  {data.latitude && data.longitude && (
                    <a href={`/map?route=1&toAddress=${encodeURIComponent(data.address || data.name)}&toLat=${data.latitude}&toLon=${data.longitude}`} className="btn smallbtn secondary" style={{ marginTop: 0 }}>🗺️ Как добраться</a>
                  )}
                  {isAdmin && (
                    <button onClick={handleRefresh} disabled={refreshing} className="btn smallbtn" style={{ marginTop: 0, background: "rgba(96,165,250,0.12)", borderColor: "rgba(96,165,250,0.3)", color: "#60a5fa" }}>
                      {refreshing ? "⏳ Обновляю..." : "↻ Обновить данные"}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={handleSummarize} disabled={summarizing} className="btn smallbtn" style={{ marginTop: 0, background: "rgba(167,139,250,0.12)", borderColor: "rgba(167,139,250,0.3)", color: "#a78bfa" }}>
                      {summarizing ? "⏳ Суммаризирую..." : "🤖 Суммаризировать отзывы"}
                    </button>
                  )}
                </div>
              </div>
              {summarizeMsg && (
                <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 10, fontSize: 13, background: summarizeMsg.ok ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${summarizeMsg.ok ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`, color: summarizeMsg.ok ? "#34d399" : "#f87171" }}>
                  {summarizeMsg.ok ? "✅ " : "⚠️ "}{summarizeMsg.text}
                </div>
              )}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, marginBottom: 16 }}>
                {data.address && <div style={row}><span style={lbl}>📍 Адрес</span><span style={val}>{data.address}</span></div>}
                {data.phone && <div style={row}><span style={lbl}>📞 Телефон</span><a href={`tel:${data.phone}`} style={{ ...val, color: "#60a5fa", textDecoration: "none" }}>{data.phone}</a></div>}
                {data.description && <div style={{ ...row, flexDirection: "column" }}><span style={{ ...lbl, marginBottom: 6 }}>📝 Описание</span><span style={{ ...val, color: "rgba(255,255,255,0.65)", fontSize: 13 }}>{data.description}</span></div>}
              </div>

              {data.latitude && data.longitude && (
                <VenueMap
                  latitude={data.latitude}
                  longitude={data.longitude}
                  name={data.name}
                  address={data.address}
                />
              )}

              {data.reviewsSummary && (
                <div style={{ padding: "14px 16px", marginBottom: 16, background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.18)", borderRadius: 12 }}>
                  <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>🤖 РЕЗЮМЕ ОТЗЫВОВ (AI)</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>{data.reviewsSummary}</div>
                </div>
              )}
              {data.reviews && data.reviews.length > 0 && (
                <div>
                  <button onClick={() => setShowReviews(v => !v)} style={{ width: "100%", textAlign: "left", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>💬 Отзывы ({data.reviews.length})</span>
                    <span style={{ fontSize: 11 }}>{showReviews ? "▲" : "▼"}</span>
                  </button>
                  {showReviews && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      {data.reviews.map((r, i) => (
                        <div key={i} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{r.author || "Аноним"}</span>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              {r.rating && <StarRating rating={r.rating} />}
                              {r.reviewDate && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{r.reviewDate}</span>}
                            </div>
                          </div>
                          {r.text && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{r.text}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {(!data.reviews || data.reviews.length === 0) && !data.reviewsSummary && (
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 8 }}>
                  Отзывы ещё не загружены.{isAdmin ? " Нажмите «Обновить данные»." : ""}
                </div>
              )}
            </div>
          )}
        </section>
        <footer className="footer" style={{ marginTop: 24 }}><span>© CityPortal</span></footer>
      </main>
    </div>
  );
}

function VenuesList() {
  const [items, setItems]               = useState([]);
  const [page, setPage]                 = useState(0);
  const [totalPages, setTotal]          = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [searchInput, setSearchInput]   = useState("");
  const [searchQuery, setSearchQuery]   = useState("");
  const [selectedCats, setSelectedCats] = useState([]);
  const [categories, setCategories]     = useState([]);
  const userRole = useUserRole();

  useEffect(() => {
    fetch("/api/venue/categories")
      .then(r => r.ok ? r.json() : [])
      .then(d => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const load = useCallback((p, q, cats) => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ page: p, size: 12 });
    if (q) params.set("q", q);
    cats.forEach(c => params.append("category", c));
    fetch(`/api/venue/list?${params}`)
      .then(r => { if (!r.ok) throw new Error("Ошибка загрузки"); return r.json(); })
      .then(d => { setItems(d.content || []); setTotal(d.totalPages || 0); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(page, searchQuery, selectedCats); }, [page, searchQuery, selectedCats, load]);

  function handleSearch(e) { e.preventDefault(); setPage(0); setSearchQuery(searchInput.trim()); }
  function handleCatsChange(cats) { setSelectedCats(cats); setPage(0); }
  function handleClearFilters() { setSearchInput(""); setSearchQuery(""); setSelectedCats([]); setPage(0); }

  const hasFilters = searchQuery || selectedCats.length > 0;

  return (
    <div className="home">
      <Topbar title="Заведения города" userRole={userRole} />
      <main className="main">
        <section className="section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 className="section-title" style={{ margin: 0 }}>🏢 Заведения</h2>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, flex: "1 1 260px", minWidth: 0 }}>
              <input className="input" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Поиск по названию или адресу..."
                style={{ flex: 1, padding: "10px 14px", fontSize: 14, borderRadius: 10, minWidth: 0 }} />
              <button type="submit" className="btn smallbtn" style={{ marginTop: 0, whiteSpace: "nowrap" }}>🔍 Найти</button>
            </form>
            <CategoryMultiSelect categories={categories} selected={selectedCats} onChange={handleCatsChange} />
            {hasFilters && (
              <button onClick={handleClearFilters} className="btn smallbtn secondary" style={{ marginTop: 0, whiteSpace: "nowrap" }}>✕ Сбросить</button>
            )}
          </div>

          {hasFilters && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {searchQuery && <span>Поиск: «{searchQuery}»</span>}
              {searchQuery && selectedCats.length > 0 && <span>·</span>}
              {selectedCats.length > 0 && <span>{selectedCats.length === 1 ? `Категория: ${selectedCats[0]}` : `Категории: ${selectedCats.join(", ")}`}</span>}
            </div>
          )}

          {loading && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>⏳ Загрузка...</div>}
          {error && <div style={{ color: "#f87171", padding: 16 }}>{error}</div>}

          {!loading && !error && items.length === 0 && (
            <div className="block" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                {hasFilters ? "Ничего не найдено по вашему запросу." : "Заведения пока не добавлены. Нажмите на объект на карте и нажмите «Об объекте»."}
              </div>
              {hasFilters
                ? <button onClick={handleClearFilters} className="btn smallbtn secondary" style={{ marginTop: 16 }}>✕ Сбросить фильтры</button>
                : <a href="/map" className="btn smallbtn" style={{ marginTop: 16, display: "inline-block" }}>🗺️ Открыть карту</a>
              }
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {items.map(item => (
                  <a key={item.id} href={`/venues/${item.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "16px 18px", transition: "all 0.15s", cursor: "pointer", height: "100%", boxSizing: "border-box" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(96,165,250,0.08)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.3)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "rgba(96,165,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏢</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{item.name}</div>
                          {item.category && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.category}</div>}
                        </div>
                      </div>
                      {item.rating && <div style={{ marginBottom: 8 }}><StarRating rating={item.rating} /></div>}
                      {item.address && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>📍 {item.address}</div>}
                      {item.reviewsSummary && (
                        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 6, padding: "2px 8px" }}>🤖 Есть AI-резюме</div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn smallbtn secondary" style={{ marginTop: 0, opacity: page === 0 ? 0.4 : 1 }}>← Назад</button>
                  <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn smallbtn secondary" style={{ marginTop: 0, opacity: page >= totalPages - 1 ? 0.4 : 1 }}>Вперёд →</button>
                </div>
              )}
            </>
          )}
        </section>
        <footer className="footer" style={{ marginTop: 24 }}><span>© CityPortal</span></footer>
      </main>
    </div>
  );
}

function VenuesApp() {
  const id = getVenueId();
  return id ? <VenueDetail id={id} /> : <VenuesList />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<VenuesApp />);