const { useEffect, useState, useCallback } = React;

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric"
  });
}

function getNewsId() {
  const match = window.location.pathname.match(/\/news\/(\d+)/);
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
          <div className="topbar-subtitle">Новости Оренбурга</div>
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

function NewsList() {
  const [items, setItems]       = useState([]);
  const [page, setPage]         = useState(0);
  const [totalPages, setTotal]  = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const isMobile = useIsMobile();

  const load = useCallback((p) => {
    setLoading(true);
    setError(null);
    let url = `/api/news?page=${p}&size=12`;
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

  useEffect(() => { load(0); }, [load]);

  return (
    <main className="main">
      <section className="hero" style={{ paddingBottom: 16 }}>
        <h1 className="hero-title">📰 Новости Оренбурга</h1>
        <p className="hero-text" style={{ marginBottom: 12 }}>Актуальные новости с orenburg.ru</p>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <a className="btn secondary" href="/">← На главную</a>
        </div>
      </section>

      <section className="section">
        {loading && <div className="small muted" style={{ textAlign: "center", padding: 24 }}>Загрузка...</div>}
        {error   && <div className="small" style={{ color: "var(--danger)", textAlign: "center", padding: 24 }}>{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="small muted" style={{ textAlign: "center", padding: 24 }}>
            Новостей пока нет. Попробуйте позже.
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
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 10,
          }}>
            {items.map(item => (
              <a key={item.id} href={`/news/${item.id}`} style={{
                textDecoration: "none", color: "inherit",
                display: "flex", flexDirection: "row", alignItems: "stretch",
                background: "rgba(0,0,0,0.16)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 12,
                overflow: "hidden",
                transition: "border-color 0.15s, background 0.15s",
                minHeight: 86
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.16)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
              >
                {item.imageUrl && (
                  <div style={{ flexShrink: 0, width: 120, overflow: "hidden", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center" }}>
                    <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                         onError={e => e.currentTarget.parentElement.style.display = "none"} />
                  </div>
                )}
                <div style={{ flex: 1, padding: "9px 11px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.35,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 3, WebkitBoxOrient: "vertical"
                  }}>{item.title}</div>
                  <div style={{ marginTop: "auto", fontSize: 11, color: "var(--muted)" }}>{formatDate(item.publishedAt)}</div>
                </div>
              </a>
            ))}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn smallbtn secondary" onClick={() => load(page - 1)} disabled={page === 0}>← Назад</button>
              <span className="small muted" style={{ alignSelf: "center" }}>Страница {page + 1} из {totalPages}</span>
              <button className="btn smallbtn secondary" onClick={() => load(page + 1)} disabled={page >= totalPages - 1}>Вперёд →</button>
            </div>
          )}
        </div>
      </section>

      <footer className="footer" style={{ marginTop: 24 }}><span>© CityPortal</span></footer>
    </main>
  );
}

function NewsDetail({ newsId }) {
  const [item, setItem]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    fetch(`/api/news/${newsId}`)
      .then(r => { if (!r.ok) throw new Error("Новость не найдена"); return r.json(); })
      .then(setItem)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [newsId]);

  if (loading) return <main className="main"><div className="small muted" style={{ padding: 40, textAlign: "center" }}>Загрузка...</div></main>;
  if (error)   return <main className="main"><div className="small" style={{ color: "var(--danger)", padding: 40, textAlign: "center" }}>{error}</div></main>;

  return (
    <main className="main">
      <section className="section" style={{ maxWidth: 760, margin: "0 auto" }}>
        <a href="/news" className="btn smallbtn secondary" style={{ marginBottom: 20, display: "inline-block" }}>← Все новости</a>

        {item.imageUrl && (
          <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 20, background: "rgba(0,0,0,0.20)", display: "flex", justifyContent: "center" }}>
            <img src={item.imageUrl} alt={item.title} style={{ width: "100%", maxHeight: 480, objectFit: "contain" }}
                 onError={e => e.currentTarget.style.display = "none"} />
          </div>
        )}

        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1.3, marginBottom: 10 }}>{item.title}</h1>

        <div className="small muted" style={{ marginBottom: 20 }}>
          {formatDate(item.publishedAt)}
          {item.sourceUrl && (
            <> · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Источник</a></>
          )}
        </div>

        {item.description && (
          <p style={{ fontSize: 15, lineHeight: 1.7, fontWeight: 600, marginBottom: 16, color: "var(--text)" }}>
            {item.description}
          </p>
        )}

        {item.content && (
          <div
            className="news-content"
            style={{ fontSize: 14, lineHeight: 1.8, color: "var(--text-secondary, var(--text))" }}
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
        )}
      </section>
      <footer className="footer" style={{ marginTop: 32 }}><span>© CityPortal</span></footer>
    </main>
  );
}

function NewsApp() {
  const newsId = getNewsId();
  return (
    <div className="home">
      <Topbar />
      {newsId ? <NewsDetail newsId={newsId} /> : <NewsList />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<NewsApp />);