const { useEffect, useState, useCallback, useRef } = React;

const ROUTE_TYPES = [
  { value: "operator", label: "🏢 От туроператора" },
  { value: "self",     label: "🚶 Самостоятельный" },
  { value: "audio",    label: "🎧 Аудиогид" },
  { value: "guide",    label: "👤 С гидом" },
];

function routeTypeLabel(type) {
  const found = ROUTE_TYPES.find(t => t.value === type);
  return found ? found.label : type;
}

function routeTypeBadgeColor(type) {
  switch (type) {
    case "operator": return { bg: "rgba(124,58,237,0.18)", border: "rgba(124,58,237,0.35)", color: "#c4b5fd" };
    case "self":     return { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.30)", color: "#6ee7b7" };
    case "audio":    return { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.25)", color: "#fbbf24" };
    case "guide":    return { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.30)", color: "#93c5fd" };
    default:         return { bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" };
  }
}

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 600);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

function TypeMultiSelect({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(value) {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const hasSelected = selected.length > 0;

  let buttonLabel;
  if (!hasSelected) {
    buttonLabel = "Все типы";
  } else if (selected.length === 1) {
    buttonLabel = routeTypeLabel(selected[0]);
  } else {
    buttonLabel = `Выбрано: ${selected.length}`;
  }

  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "9px 14px", borderRadius: 10, cursor: "pointer",
          border: hasSelected ? "1px solid rgba(124,58,237,0.70)" : "1px solid rgba(255,255,255,0.18)",
          background: hasSelected ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.07)",
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
          position: "absolute", zIndex: 200, top: "calc(100% + 8px)", left: 0,
          background: "#0f1623",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.60), 0 0 0 1px rgba(124,58,237,0.10)",
          padding: "8px",
          minWidth: 220
        }}>
          {ROUTE_TYPES.map(t => {
            const isActive = selected.includes(t.value);
            const badge = routeTypeBadgeColor(t.value);
            return (
              <div
                key={t.value}
                onClick={() => toggle(t.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 10, cursor: "pointer",
                  background: isActive ? "rgba(124,58,237,0.18)" : "transparent",
                  transition: "background 0.12s",
                  userSelect: "none"
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Чекбокс */}
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: isActive ? "2px solid rgba(124,58,237,0.90)" : "2px solid rgba(255,255,255,0.25)",
                  background: isActive ? "rgba(124,58,237,0.80)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.12s"
                }}>
                  {isActive && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {/* Бейдж + текст */}
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                  background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
                  whiteSpace: "nowrap"
                }}>
                  {t.label}
                </span>
              </div>
            );
          })}

          {hasSelected && (
            <div
              onClick={() => { onChange([]); setOpen(false); }}
              style={{
                marginTop: 4, padding: "7px 12px", borderRadius: 10, cursor: "pointer",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.40)", fontSize: 12,
                textAlign: "center", userSelect: "none",
                transition: "background 0.12s"
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

function Topbar() {
  const [account, setAccount] = useState(null);

  useEffect(() => {
    fetch("/api/auth/account", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setAccount(d))
      .catch(() => {});
  }, []);

  async function logout() {
    try {
      const res = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
      const { token } = await res.json();
      await fetch("/logout", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-CSRF-TOKEN": token },
        body: new URLSearchParams({ _csrf: token }).toString()
      });
      window.location.href = "/login?logout";
    } catch { window.location.href = "/login"; }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo small" />
        <div>
          <div className="topbar-title">
            <a href="/" style={{ color: "inherit", textDecoration: "none" }}>CityPortal</a>
          </div>
          <div className="topbar-subtitle">Маршруты Оренбуржья</div>
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
      </div>
    </header>
  );
}

function RouteCard({ item }) {
  const badge = routeTypeBadgeColor(item.routeType);
  return (
    <a
      href={item.sourceUrl || "#"}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        textDecoration: "none", color: "inherit",
        display: "flex", flexDirection: "column",
        background: "rgba(0,0,0,0.18)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14, overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s, transform 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.07)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(0,0,0,0.18)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
        e.currentTarget.style.transform = "none";
      }}
    >
      {item.imageUrl ? (
        <div style={{ width: "100%", aspectRatio: "3/2", background: "rgba(0,0,0,0.30)", flexShrink: 0 }}>
          <img
            src={item.imageUrl} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => e.currentTarget.parentElement.style.display = "none"}
          />
        </div>
      ) : (
        <div style={{
          width: "100%", aspectRatio: "3/2",
          background: "rgba(124,58,237,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem"
        }}>🗺️</div>
      )}

      <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          display: "inline-block", alignSelf: "flex-start",
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
          background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color
        }}>
          {routeTypeLabel(item.routeType)}
        </div>
        <div style={{
          fontWeight: 700, fontSize: 13, lineHeight: 1.35,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical"
        }}>
          {item.title}
        </div>
        {item.operatorName && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            🏢 {item.operatorName}
          </div>
        )}
        {item.duration && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginTop: "auto" }}>
            ⏱ {item.duration}
          </div>
        )}
      </div>
    </a>
  );
}

function RoutesList() {
  const [items, setItems]          = useState([]);
  const [page, setPage]            = useState(0);
  const [totalPages, setTotal]     = useState(0);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState(null);
  const [search, setSearch]        = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const isMobile = useIsMobile();

  const load = useCallback((p, titleFilter, types) => {
    setLoading(true);
    setError(null);

    const hasTitle = titleFilter && titleFilter.trim();
    const hasTypes = types && types.length > 0;

    let url = `/api/routes?page=${p}&size=16`;
    if (hasTitle) url += `&title=${encodeURIComponent(titleFilter.trim())}`;
    if (hasTypes) types.forEach(t => { url += `&routeTypes=${encodeURIComponent(t)}`; });
    if (!hasTitle && !hasTypes) url += `&random=true`;

    fetch(url)
      .then(r => { if (!r.ok) throw new Error("Ошибка загрузки"); return r.json(); })
      .then(data => {
        setItems(data.content || []);
        const pageInfo = data.page || data;
        setTotal(pageInfo.totalPages || 0);
        setPage(p);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(0, search, selectedTypes); }, [load]);

  const searchTimeout = useRef(null);
  function onSearchChange(val) {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(0, val, selectedTypes), 300);
  }

  function onTypesChange(types) {
    setSelectedTypes(types);
    load(0, search, types);
  }

  function clearFilters() {
    setSearch(""); setSelectedTypes([]);
    load(0, "", []);
  }

  const hasFilter = search || selectedTypes.length > 0;

  return (
    <main className="main">
      <section className="hero" style={{ paddingBottom: 16 }}>
        <h1 className="hero-title">🗺️ Маршруты Оренбуржья</h1>
        <p className="hero-text" style={{ marginBottom: 12 }}>
          Экскурсионные маршруты с travel.orb.ru
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <a className="btn secondary" href="/">← На главную</a>
        </div>

        <div style={{
          display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", alignItems: "center",
          maxWidth: 700, margin: "0 auto"
        }}>
          <input
            type="text"
            placeholder="🔍 Поиск по названию..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{
              flex: "1 1 220px", minWidth: 0,
              padding: "9px 14px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.07)",
              color: "var(--text, #fff)", fontSize: 14, outline: "none"
            }}
          />
          <TypeMultiSelect selected={selectedTypes} onChange={onTypesChange} />
          {hasFilter && (
            <button className="btn smallbtn secondary" onClick={clearFilters} style={{ whiteSpace: "nowrap" }}>
              ✕ Сбросить
            </button>
          )}
        </div>
      </section>

      <section className="section">
        {loading && (
          <div className="small muted" style={{ textAlign: "center", padding: 24 }}>Загрузка...</div>
        )}
        {error && (
          <div className="small" style={{ color: "var(--danger)", textAlign: "center", padding: 24 }}>{error}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="small muted" style={{ textAlign: "center", padding: 24 }}>
            {hasFilter ? "По вашему запросу ничего не найдено." : "Маршруты ещё не загружены."}
          </div>
        )}

        <div style={{
          padding: 14,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 18,
          boxShadow: "0 18px 60px rgba(0,0,0,0.20)"
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
            gap: 16
          }}>
            {items.map(item => <RouteCard key={item.id} item={item} />)}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                className="btn smallbtn secondary"
                onClick={() => load(page - 1, search, selectedTypes)}
                disabled={page === 0}
              >← Назад</button>
              <span className="small muted" style={{ alignSelf: "center" }}>
                Страница {page + 1} из {totalPages}
              </span>
              <button
                className="btn smallbtn secondary"
                onClick={() => load(page + 1, search, selectedTypes)}
                disabled={page >= totalPages - 1}
              >Вперёд →</button>
            </div>
          )}
        </div>
      </section>

      <footer className="footer" style={{ marginTop: 24 }}><span>© CityPortal</span></footer>
    </main>
  );
}

function RoutesApp() {
  return (
    <div className="home">
      <Topbar />
      <RoutesList />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<RoutesApp />);