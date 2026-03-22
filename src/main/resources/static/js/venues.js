const { useEffect, useState, useCallback } = React;

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
      {"★".repeat(Math.min(full, 5))}{"☆".repeat(Math.max(0, 5 - full))}
      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginLeft: 4 }}>{rating}</span>
    </span>
  );
}

function Topbar({ title }) {
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
        <a className="btn smallbtn secondary" href="/">← На главную</a>
      </div>
    </header>
  );
}

function VenueDetail({ id }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showReviews, setShowReviews] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/venue/${id}`)
      .then(r => { if (!r.ok) throw new Error("Заведение не найдено"); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    if (!data) return;
    setRefreshing(true);
    const params = new URLSearchParams({
      name: data.name || "",
      address: data.address || "",
      lat: data.latitude,
      lon: data.longitude
    });
    try {
      const r = await fetch(`/api/venue/refresh?${params}`, { method: "POST" });
      const d = await r.json();
      setData(d);
    } catch (_) {}
    setRefreshing(false);
  }

  const row = { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 };
  const label = { fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, minWidth: 80, paddingTop: 2 };
  const value = { fontSize: 14, color: "rgba(255,255,255,0.88)", flex: 1, lineHeight: 1.6 };

  return (
    <div className="home">
      <Topbar title="Заведения" />
      <main className="main">
        <section className="section">
          <div style={{ marginBottom: 12 }}>
            <a href="/venues" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}>
              ← Все заведения
            </a>
          </div>

          {loading && (
            <div className="block" style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>
              ⏳ Загрузка...
            </div>
          )}
          {error && (
            <div className="block" style={{ color: "#f87171", padding: 24 }}>{error}</div>
          )}

          {!loading && !error && data && (
            <div className="block">
              {/* Заголовок */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>{data.name}</h2>
                  {data.category && (
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{data.category}</div>
                  )}
                  {data.rating && (
                    <div style={{ marginTop: 6 }}><StarRating rating={data.rating} /></div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {data.yandexUrl && (
                    <a href={data.yandexUrl} target="_blank" rel="noreferrer"
                      className="btn smallbtn secondary" style={{ marginTop: 0 }}>
                      🗺 Яндекс Карты ↗
                    </a>
                  )}
                  {data.latitude && data.longitude && (
                    <a href={`/map?route=1&toAddress=${encodeURIComponent(data.address || data.name)}&toLat=${data.latitude}&toLon=${data.longitude}`}
                      className="btn smallbtn secondary" style={{ marginTop: 0 }}>
                      🗺️ Как добраться
                    </a>
                  )}
                  <button onClick={handleRefresh} disabled={refreshing}
                    className="btn smallbtn" style={{ marginTop: 0, background: "rgba(96,165,250,0.12)", borderColor: "rgba(96,165,250,0.3)", color: "#60a5fa" }}>
                    {refreshing ? "⏳ Обновляю..." : "↻ Обновить данные"}
                  </button>
                </div>
              </div>

              {/* Контакты */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, marginBottom: 16 }}>
                {data.address && (
                  <div style={row}>
                    <span style={label}>📍 Адрес</span>
                    <span style={value}>{data.address}</span>
                  </div>
                )}
                {data.phone && (
                  <div style={row}>
                    <span style={label}>📞 Телефон</span>
                    <a href={`tel:${data.phone}`} style={{ ...value, color: "#60a5fa", textDecoration: "none" }}>
                      {data.phone}
                    </a>
                  </div>
                )}
                {data.description && (
                  <div style={{ ...row, flexDirection: "column" }}>
                    <span style={{ ...label, marginBottom: 6 }}>📝 Описание</span>
                    <span style={{ ...value, color: "rgba(255,255,255,0.65)", fontSize: 13 }}>{data.description}</span>
                  </div>
                )}
              </div>

              {/* AI Резюме */}
              {data.reviewsSummary && (
                <div style={{
                  padding: "14px 16px", marginBottom: 16,
                  background: "rgba(96,165,250,0.07)",
                  border: "1px solid rgba(96,165,250,0.18)",
                  borderRadius: 12
                }}>
                  <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>
                    🤖 РЕЗЮМЕ ОТЗЫВОВ (AI)
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>
                    {data.reviewsSummary}
                  </div>
                </div>
              )}

              {/* Отзывы */}
              {data.reviews && data.reviews.length > 0 && (
                <div>
                  <button onClick={() => setShowReviews(v => !v)}
                    style={{
                      width: "100%", textAlign: "left", background: "none",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                      padding: "10px 14px", cursor: "pointer", color: "rgba(255,255,255,0.7)",
                      fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center"
                    }}>
                    <span>💬 Отзывы ({data.reviews.length})</span>
                    <span style={{ fontSize: 11 }}>{showReviews ? "▲" : "▼"}</span>
                  </button>

                  {showReviews && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      {data.reviews.map((r, i) => (
                        <div key={i} style={{
                          padding: "12px 14px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 10
                        }}>
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
                  Отзывы ещё не загружены. Нажмите «Обновить данные».
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
  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(0);
  const [totalPages, setTotal]    = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const load = useCallback((p) => {
    setLoading(true);
    setError(null);
    fetch(`/api/venue/list?page=${p}&size=12`)
      .then(r => { if (!r.ok) throw new Error("Ошибка загрузки"); return r.json(); })
      .then(d => {
        setItems(d.content || []);
        setTotal(d.totalPages || 0);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  return (
    <div className="home">
      <Topbar title="Заведения города" />
      <main className="main">
        <section className="section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 className="section-title" style={{ margin: 0 }}>🏢 Заведения</h2>
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>⏳ Загрузка...</div>
          )}
          {error && (
            <div style={{ color: "#f87171", padding: 16 }}>{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="block" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                Заведения пока не добавлены.<br/>
                Нажмите на объект на карте и нажмите «Об объекте» — данные сохранятся здесь.
              </div>
              <a href="/map" className="btn smallbtn" style={{ marginTop: 16, display: "inline-block" }}>
                🗺️ Открыть карту
              </a>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {items.map(item => (
                  <a key={item.id} href={`/venues/${item.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 14, padding: "16px 18px",
                      transition: "all 0.15s", cursor: "pointer", height: "100%", boxSizing: "border-box"
                    }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(96,165,250,0.08)";
                        e.currentTarget.style.borderColor = "rgba(96,165,250,0.3)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                      }}>
                      {/* Иконка + название */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                          background: "rgba(96,165,250,0.12)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22
                        }}>🏢</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 2,
                            overflow: "hidden", display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {item.name}
                          </div>
                          {item.category && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.category}</div>
                          )}
                        </div>
                      </div>

                      {/* Рейтинг */}
                      {item.rating && (
                        <div style={{ marginBottom: 8 }}><StarRating rating={item.rating} /></div>
                      )}

                      {/* Адрес */}
                      {item.address && (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 6,
                          overflow: "hidden", display: "-webkit-box",
                          WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                          📍 {item.address}
                        </div>
                      )}

                      {/* Тег отзывов */}
                      {item.reviewsSummary && (
                        <div style={{
                          marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 11, color: "#60a5fa",
                          background: "rgba(96,165,250,0.08)",
                          border: "1px solid rgba(96,165,250,0.15)",
                          borderRadius: 6, padding: "2px 8px"
                        }}>
                          🤖 Есть AI-резюме
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>

              {/* Пагинация */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="btn smallbtn secondary" style={{ marginTop: 0, opacity: page === 0 ? 0.4 : 1 }}>
                    ← Назад
                  </button>
                  <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                    {page + 1} / {totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="btn smallbtn secondary" style={{ marginTop: 0, opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                    Вперёд →
                  </button>
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