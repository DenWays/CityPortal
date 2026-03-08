const { useEffect, useState, useRef, useCallback } = React;

function MiniMapPicker({ onPick, initialAddress, mapId }) {
  const domId = mapId || "profile-minimap";
  const [mapReady, setMapReady]   = useState(false);
  const [mapError, setMapError]   = useState(null);
  const [query, setQuery]         = useState(initialAddress || "");
  const [suggestions, setSuggestions] = useState([]);
  const [sugOpen, setSugOpen]     = useState(false);
  const mapRef     = useRef(null);
  const markerRef  = useRef(null);
  const initDone   = useRef(false);
  const debRef     = useRef(null);
  const wrapRef    = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setSugOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (window._ymapsLoaded) { window.ymaps.ready(() => setMapReady(true)); return; }
    fetch("/api/maps/js-key")
      .then(r => r.ok ? r.text() : Promise.reject("no key"))
      .then(key => {
        const s = document.createElement("script");
        s.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
        s.async = true;
        s.onload = () => { window._ymapsLoaded = true; window.ymaps.ready(() => setMapReady(true)); };
        s.onerror = () => setMapError("Не удалось загрузить карту");
        document.head.appendChild(s);
      })
      .catch(() => setMapError("Не удалось получить ключ карты"));
  }, []);

  useEffect(() => {
    if (!mapReady || initDone.current) return;
    initDone.current = true;
    const map = new window.ymaps.Map(domId, {
      center: [51.7727, 55.1039], zoom: 13,
      controls: ["zoomControl", "geolocationControl"]
    });
    mapRef.current = map;

    map.events.add("click", (e) => {
      const [lat, lon] = e.get("coords");
      placeMarker([lat, lon]);
      window.ymaps.geocode([lat, lon]).then(res => {
        const addr = res.geoObjects.get(0)?.getAddressLine() || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setQuery(addr);
        setSugOpen(false);
        onPick({ address: addr, lat, lon });
      });
    });
  }, [mapReady]);

  function placeMarker(coords) {
    if (!mapRef.current) return;
    if (markerRef.current) mapRef.current.geoObjects.remove(markerRef.current);
    markerRef.current = new window.ymaps.Placemark(coords,
      { hintContent: "Выбранное место" },
      { preset: "islands#redDotIcon" }
    );
    mapRef.current.geoObjects.add(markerRef.current);
  }

  const handleInput = (val) => {
    setQuery(val);
    clearTimeout(debRef.current);
    if (val.length < 2) { setSuggestions([]); setSugOpen(false); return; }
    debRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent("Оренбург, " + val)}`);
        const json = await res.json();
        const items = json?.response?.GeoObjectCollection?.featureMember ?? [];
        const parsed = items.slice(0, 5).map(f => {
          const geo = f.GeoObject;
          const pos = geo.Point.pos.split(" ").map(Number);
          return { name: geo.metaDataProperty?.GeocoderMetaData?.text || geo.name, lat: pos[1], lon: pos[0] };
        });
        setSuggestions(parsed);
        setSugOpen(parsed.length > 0);
      } catch { setSuggestions([]); setSugOpen(false); }
    }, 350);
  };

  const handleSugSelect = (s) => {
    setQuery(s.name);
    setSuggestions([]); setSugOpen(false);
    onPick({ address: s.name, lat: s.lat, lon: s.lon });
    if (mapRef.current) {
      placeMarker([s.lat, s.lon]);
      mapRef.current.setCenter([s.lat, s.lon], 15, { duration: 400 });
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Address search */}
      <div ref={wrapRef} style={{ position: "relative", marginBottom: 8 }}>
        <input
          className="input"
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="Введите адрес или кликните на карте"
        />
        {sugOpen && suggestions.length > 0 && (
          <ul style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
            background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8, margin: 0, padding: 0, listStyle: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)", maxHeight: 200, overflowY: "auto"
          }}>
            {suggestions.map((s, i) => (
              <li key={i} onMouseDown={() => handleSugSelect(s)} style={{
                padding: "9px 14px", cursor: "pointer", fontSize: 13,
                borderBottom: "1px solid rgba(255,255,255,0.06)"
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >{s.name}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Mini map */}
      {mapError && <div className="small" style={{ color: "var(--danger)", marginBottom: 6 }}>{mapError}</div>}
      {!mapReady && !mapError && <div className="small muted" style={{ padding: "12px 0" }}>Загрузка карты…</div>}
      <div
        id={domId}
        style={{
          width: "100%", height: 260, borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          overflow: "hidden", cursor: "crosshair",
          display: mapReady ? "block" : "none"
        }}
      />
      <div className="small muted" style={{ marginTop: 6 }}>Кликните на карте или введите адрес выше</div>
    </div>
  );
}

function SavedAddressesSection() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState(null);

  const [adding, setAdding]       = useState(false);
  const [newLabel, setNewLabel]   = useState("");
  const [newPick, setNewPick]     = useState(null);

  const [editId, setEditId]       = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPick, setEditPick]   = useState(null);

  useEffect(() => { fetchAddresses(); }, []);

  async function fetchAddresses() {
    setLoading(true);
    try {
      const res = await fetch("/api/addresses", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Ошибка загрузки адресов");
      setAddresses(await res.json());
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newLabel.trim() || !newPick?.address) {
      setMsg({ type: "err", text: "Введите название и выберите адрес на карте" });
      return;
    }
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/addresses", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify({ label: newLabel.trim(), address: newPick.address, lat: newPick.lat, lon: newPick.lon })
      });
      if (!res.ok) throw new Error("Ошибка при сохранении");
      setNewLabel(""); setNewPick(null); setAdding(false);
      setMsg({ type: "ok", text: "Адрес добавлен!" });
      fetchAddresses();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    }
  }

  async function handleUpdate(id) {
    if (!editLabel.trim() || !editPick?.address) {
      setMsg({ type: "err", text: "Введите название и выберите адрес" });
      return;
    }
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/addresses/${id}`, {
        method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify({ label: editLabel.trim(), address: editPick.address, lat: editPick.lat, lon: editPick.lon })
      });
      if (!res.ok) throw new Error("Ошибка при обновлении");
      setEditId(null);
      setMsg({ type: "ok", text: "Адрес обновлён!" });
      fetchAddresses();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    }
  }

  async function handleDelete(id) {
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/addresses/${id}`, {
        method: "DELETE", credentials: "same-origin",
        headers: { "X-CSRF-TOKEN": token }
      });
      if (!res.ok) throw new Error("Ошибка при удалении");
      setMsg({ type: "ok", text: "Адрес удалён!" });
      fetchAddresses();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    }
  }

  function startEdit(a) {
    setEditId(a.id);
    setEditLabel(a.label);
    setEditPick({ address: a.address, lat: a.lat, lon: a.lon });
    setAdding(false);
  }

  function cancelAdd() {
    setAdding(false); setNewLabel(""); setNewPick(null);
  }

  function cancelEdit() {
    setEditId(null); setEditLabel(""); setEditPick(null);
  }

  return (
    <section className="section">
      <h2 className="section-title">📍 Сохранённые адреса</h2>
      <div className="block">
        {msg && (
          <div className={"msg " + (msg.type === "ok" ? "ok" : "err")} style={{ marginBottom: 12 }}>
            {msg.text}
          </div>
        )}

        {/* List */}
        {loading ? (
          <p className="small">Загрузка...</p>
        ) : addresses.length === 0 ? (
          <p className="small muted">Нет сохранённых адресов.</p>
        ) : (
          <div className="list">
            {addresses.map(a => (
              <div key={a.id} className="list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                {editId === a.id ? (
                  // ── Edit form ──
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      className="input"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      placeholder="Название (Дом, Работа…)"
                    />
                    {editPick?.address && (
                      <div className="small muted">📍 {editPick.address}</div>
                    )}
                    <MiniMapPicker
                      key={"edit-" + a.id}
                      mapId={"profile-minimap-edit-" + a.id}
                      initialAddress={a.address}
                      onPick={p => setEditPick(p)}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button className="btn smallbtn" onClick={() => handleUpdate(a.id)}>Сохранить</button>
                      <button className="btn smallbtn secondary" onClick={cancelEdit}>Отмена</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 16 }}>⭐</span>
                        <b>{a.label}</b>
                      </div>
                      <div className="small muted" style={{ marginTop: 2 }}>{a.address}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn smallbtn secondary" onClick={() => startEdit(a)}>✏️</button>
                      <button className="btn smallbtn secondary" onClick={() => handleDelete(a.id)}>🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <div style={{ marginTop: 16 }}>
          {adding ? (
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                className="input"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Название (Дом, Работа…)"
                required
              />
              {newPick?.address && (
                <div className="small muted">📍 {newPick.address}</div>
              )}
              <MiniMapPicker key="add" mapId="profile-minimap-add" onPick={p => setNewPick(p)} />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button className="btn smallbtn" type="submit">Добавить</button>
                <button className="btn smallbtn secondary" type="button" onClick={cancelAdd}>Отмена</button>
              </div>
            </form>
          ) : (
            <button className="btn smallbtn" onClick={() => { setAdding(true); setEditId(null); }}>+ Добавить адрес</button>
          )}
        </div>
      </div>
    </section>
  );
}

async function getCsrfToken() {
  const res = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
  if (!res.ok) throw new Error("CSRF token request failed");
  const data = await res.json();
  return data.token;
}

function ProfilePage() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/account", { credentials: "same-origin" });
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("Не удалось получить профиль");
        const data = await res.json();
        setAccount(data);
      } catch (e) {
        setMsg({ type: "err", text: e.message || "Ошибка" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      window.location.href = "/login";
    }
  }

  return (
    <div className="home">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo small" />
          <div>
            <div className="topbar-title">Профиль</div>
            <div className="topbar-subtitle">CityPortal</div>
          </div>
        </div>

        <div className="topbar-right">
          <a className="btn smallbtn secondary" href="/">Главная</a>
          <button className="btn smallbtn secondary" onClick={logout}>Выйти</button>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1 className="hero-title">Ваш аккаунт</h1>
          <p className="hero-text">Тестовая страница профиля.</p>
        </section>

        <section className="section">
          <h2 className="section-title">Данные</h2>

          <div className="block">
            {loading ? (
              <p className="small">Загрузка...</p>
            ) : account ? (
              <div className="list">
                <div className="list-item">
                  <div>
                    <b>Login</b>
                    <div className="small muted">{account.login}</div>
                  </div>
                </div>

                <div className="list-item">
                  <div>
                    <b>Email</b>
                    <div className="small muted">{account.email}</div>
                  </div>
                </div>

                <div className="list-item">
                  <div>
                    <b>Дата создания</b>
                    <div className="small muted">{account.creatingDate || "-"}</div>
                  </div>
                </div>

                <div className="list-item">
                  <div>
                    <b>Роль</b>
                    <div className="small muted">
                      {account.role?.name ? account.role.name : "(не загружено)"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="small">Профиль пустой</p>
            )}

            {msg && (
              <div className={"msg " + (msg.type === "ok" ? "ok" : "err")}>
                {msg.text}
              </div>
            )}
          </div>
        </section>

        <SavedAddressesSection />

      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProfilePage />);