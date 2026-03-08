const { useEffect, useState, useCallback, useRef } = React;

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric"
  });
}

function getEventId() {
  const match = window.location.pathname.match(/\/afisha\/(\d+)/);
  return match ? Number(match[1]) : null;
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

const RU_MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь",
                   "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const RU_DAYS   = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

const navBtn = {
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, color: "rgba(255,255,255,0.80)", cursor: "pointer",
  width: 28, height: 28, fontSize: 16, display: "flex", alignItems: "center",
  justifyContent: "center", fontFamily: "inherit", padding: 0
};

function DatePicker({ label: labelProp, value, onChange }) {
  const today = new Date();
  const initYear  = value ? parseInt(value.slice(0,4)) : today.getFullYear();
  const initMonth = value ? parseInt(value.slice(5,7)) - 1 : today.getMonth();
  const [open, setOpen]           = useState(false);
  const [viewYear,  setViewYear]  = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.slice(0,4)));
      setViewMonth(parseInt(value.slice(5,7)) - 1);
    }
  }, [value]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function buildCells() {
    const first = new Date(viewYear, viewMonth, 1);
    let startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function toIso(day) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  function selectDay(day) {
    const iso = toIso(day);
    onChange(value === iso ? "" : iso);
    setOpen(false);
  }

  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  let label = labelProp || "📅 Дата";
  if (value) {
    const d = new Date(value + "T00:00:00");
    label = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  }

  const cells = buildCells();

  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "9px 14px", borderRadius: 10, cursor: "pointer",
        border: value ? "1px solid rgba(124,58,237,0.70)" : "1px solid rgba(255,255,255,0.18)",
        background: value ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.07)",
        color: "rgba(255,255,255,0.92)", fontSize: 14,
        fontFamily: "inherit", fontWeight: value ? 700 : 400,
        whiteSpace: "nowrap", userSelect: "none",
        transition: "border-color 0.15s, background 0.15s"
      }}>
        <span>{label}</span>
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
          padding: "14px 14px 10px",
          minWidth: 272
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 10 }}>
            <button onClick={prevMonth} style={navBtn}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,0.92)" }}>
              {RU_MONTHS[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} style={navBtn}>›</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom: 4 }}>
            {RU_DAYS.map(d => (
              <div key={d} style={{ textAlign:"center", fontSize: 11,
                color: "rgba(255,255,255,0.35)", fontWeight: 600, padding: "2px 0" }}>{d}</div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap: 2 }}>
            {cells.map((day, i) => {
              if (day === null) return <div key={"e"+i} />;
              const iso      = toIso(day);
              const isToday  = iso === todayIso;
              const isSel    = iso === value;
              const dow      = (new Date(viewYear, viewMonth, day).getDay() + 6) % 7;
              const isWeekend = dow >= 5;
              return (
                <button key={day} onClick={() => selectDay(day)} style={{
                  textAlign: "center", fontSize: 13, padding: "6px 0",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  fontWeight: isSel ? 800 : isToday ? 700 : 400,
                  background: isSel
                    ? "linear-gradient(135deg,rgba(124,58,237,0.95),rgba(59,130,246,0.85))"
                    : isToday ? "rgba(124,58,237,0.20)" : "transparent",
                  color: isSel ? "#fff" : isWeekend ? "rgba(239,68,68,0.80)" : "rgba(255,255,255,0.85)",
                  boxShadow: isSel ? "0 4px 12px rgba(124,58,237,0.40)" : "none",
                  outline: isToday && !isSel ? "1px solid rgba(124,58,237,0.40)" : "none",
                  transition: "background 0.1s"
                }}
                onMouseEnter={e => { if(!isSel) e.currentTarget.style.background="rgba(255,255,255,0.09)"; }}
                onMouseLeave={e => { if(!isSel) e.currentTarget.style.background=isToday?"rgba(124,58,237,0.20)":"transparent"; }}
                >{day}</button>
              );
            })}
          </div>

          {value && (
            <button onClick={() => { onChange(""); setOpen(false); }} style={{
              marginTop: 10, width: "100%", padding: "7px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", fontFamily: "inherit"
            }}>✕ Сбросить дату</button>
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
          <div className="topbar-title"><a href="/" style={{ color: "inherit", textDecoration: "none" }}>CityPortal</a></div>
          <div className="topbar-subtitle">Афиша Оренбурга</div>
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

function EventsList() {
  const [items, setItems]      = useState([]);
  const [page, setPage]        = useState(0);
  const [totalPages, setTotal] = useState(0);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState(null);
  const [search, setSearch]    = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const isMobile = useIsMobile();

  const load = useCallback((p, titleFilter, from, to) => {
    setLoading(true);
    setError(null);
    let url = `/api/afisha?page=${p}&size=16`;
    if (titleFilter && titleFilter.trim()) url += `&title=${encodeURIComponent(titleFilter.trim())}`;
    if (from && from.trim()) url += `&dateFrom=${encodeURIComponent(from.trim())}`;
    if (to   && to.trim())   url += `&dateTo=${encodeURIComponent(to.trim())}`;
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

  useEffect(() => { load(0, search, dateFrom, dateTo); }, [load]);

  const searchTimeout = useRef(null);
  function onSearchChange(val) {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(0, val, dateFrom, dateTo), 300);
  }

  function onDateFromChange(val) { setDateFrom(val); load(0, search, val, dateTo); }
  function onDateToChange(val)   { setDateTo(val);   load(0, search, dateFrom, val); }

  function clearFilters() {
    setSearch(""); setDateFrom(""); setDateTo("");
    load(0, "", "", "");
  }

  const hasFilter = search || dateFrom || dateTo;

  return (
    <main className="main">
      <section className="hero" style={{ paddingBottom: 16 }}>
        <h1 className="hero-title">🎭 Афиша Оренбурга</h1>
        <p className="hero-text" style={{ marginBottom: 12 }}>Мероприятия с orb.okkassa.ru</p>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <a className="btn secondary" href="/">← На главную</a>
        </div>

        <div style={{
          display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", alignItems: "center",
          maxWidth: 800, margin: "0 auto"
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
          <DatePicker label="📅 С" value={dateFrom} onChange={onDateFromChange} />
          <DatePicker label="📅 По" value={dateTo}   onChange={onDateToChange} />
          {hasFilter && (
            <button className="btn smallbtn secondary" onClick={clearFilters} style={{ whiteSpace: "nowrap" }}>
              ✕ Сбросить
            </button>
          )}
        </div>
      </section>

      <section className="section">
        {loading && <div className="small muted" style={{ textAlign: "center", padding: 24 }}>Загрузка...</div>}
        {error   && <div className="small" style={{ color: "var(--danger)", textAlign: "center", padding: 24 }}>{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="small muted" style={{ textAlign: "center", padding: 24 }}>
            {hasFilter ? "По вашему запросу ничего не найдено." : "Мероприятий пока нет. Данные загружаются..."}
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
            {items.map(item => (
              <a key={item.id} href={item.sourceUrl || "#"} target="_blank" rel="noopener noreferrer" style={{
                textDecoration: "none", color: "inherit",
                display: "flex", flexDirection: "column",
                background: "rgba(0,0,0,0.18)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                overflow: "hidden",
                transition: "border-color 0.15s, background 0.15s, transform 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.18)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.transform = "none"; }}
              >
                {item.imageUrl ? (
                  <div style={{ width: "100%", aspectRatio: "428 / 605", background: "rgba(0,0,0,0.30)", flexShrink: 0 }}>
                    <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                         onError={e => e.currentTarget.parentElement.style.display = "none"} />
                  </div>
                ) : (
                  <div style={{ width: "100%", aspectRatio: "428 / 605", background: "rgba(124,58,237,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem" }}>🎭</div>
                )}
                <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.35,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical"
                  }}>{item.title}</div>
                  {item.venue && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>📍 {item.venue}</div>
                  )}
                  <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {item.eventDate && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)" }}>🗓 {formatDate(item.eventDate)}</div>
                    )}
                    {item.price && (
                      <div style={{ fontSize: 12, fontWeight: 700,
                        color: "#fbbf24",
                        background: "rgba(251,191,36,0.10)", padding: "2px 8px",
                        borderRadius: 6, border: "1px solid rgba(251,191,36,0.20)"
                      }}>{item.price}</div>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn smallbtn secondary" onClick={() => load(page - 1, search, dateFrom, dateTo)} disabled={page === 0}>← Назад</button>
              <span className="small muted" style={{ alignSelf: "center" }}>Страница {page + 1} из {totalPages}</span>
              <button className="btn smallbtn secondary" onClick={() => load(page + 1, search, dateFrom, dateTo)} disabled={page >= totalPages - 1}>Вперёд →</button>
            </div>
          )}
        </div>
      </section>

      <footer className="footer" style={{ marginTop: 24 }}><span>© CityPortal</span></footer>
    </main>
  );
}

function AfishaApp() {
  return (
    <div className="home">
      <Topbar />
      <EventsList />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AfishaApp />);