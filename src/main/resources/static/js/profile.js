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

function CollapsibleSection({ title, children }) {
  const [open, setOpen] = useState(true);
  const [height, setHeight] = useState("auto");
  const contentRef = useRef(null);

  // On first render record real height
  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight + "px");
    }
  }, []);

  // Whenever children change (e.g. list loaded) update height
  useEffect(() => {
    if (open && contentRef.current) {
      setHeight(contentRef.current.scrollHeight + "px");
    }
  });

  const toggle = () => {
    if (open) {
      // snapshot current height then animate to 0
      if (contentRef.current) setHeight(contentRef.current.scrollHeight + "px");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight("0px"));
      });
    } else {
      if (contentRef.current) setHeight(contentRef.current.scrollHeight + "px");
    }
    setOpen(o => !o);
  };

  return (
    <section className="section">
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}
        onClick={toggle}
      >
        <h2 className="section-title" style={{ margin: 0, flex: 1 }}>{title}</h2>
        <span style={{
          fontSize: 18, color: "rgba(255,255,255,0.5)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
          transform: open ? "rotate(0deg)" : "rotate(-90deg)", display: "inline-block", lineHeight: 1
        }}>▾</span>
      </div>
      <div
        ref={contentRef}
        style={{
          overflow: "hidden",
          height: height,
          transition: "height 0.38s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div style={{ paddingTop: 12 }}>
          {children}
        </div>
      </div>
    </section>
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
    <CollapsibleSection title="📍 Сохранённые адреса">
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
    </CollapsibleSection>
  );
}

function RouteAddressField({ label, value, onChange, savedAddresses }) {
  const [inputVal, setInputVal] = useState(value.address || "");
  const [showFavs, setShowFavs] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setInputVal(value.address || "");
  }, [value.address]);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowFavs(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = inputVal.length >= 1
    ? savedAddresses.filter(a =>
        a.label.toLowerCase().includes(inputVal.toLowerCase()) ||
        a.address.toLowerCase().includes(inputVal.toLowerCase()))
    : savedAddresses;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          className="input"
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); onChange({ address: e.target.value, lat: null, lon: null }); }}
          onFocus={() => setShowFavs(true)}
          placeholder={label}
          style={{ flex: 1 }}
        />
        {savedAddresses.length > 0 && (
          <button type="button" className="btn smallbtn secondary"
            onClick={() => setShowFavs(o => !o)} style={{ flexShrink: 0 }}>⭐</button>
        )}
      </div>
      {showFavs && filtered.length > 0 && (
        <ul style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
          background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, margin: 0, padding: 0, listStyle: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          maxHeight: 138, overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(251,191,36,0.4) rgba(255,255,255,0.04)"
        }}
          className="profile-dropdown-scroll"
        >
          {filtered.map((a, i) => (
            <li key={i} onMouseDown={() => {
              setInputVal(a.address);
              onChange({ address: a.address, lat: a.lat, lon: a.lon });
              setShowFavs(false);
            }} style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(251,191,36,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <b>{a.label}</b>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{a.address}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RouteForm({ label, setLabel, from, setFrom, to, setTo, onSubmit, onCancel, submitText, savedAddresses }) {
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        className="input"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Название маршрута (необязательно)"
      />
      <RouteAddressField label="Откуда" value={from} onChange={setFrom} savedAddresses={savedAddresses} />
      <RouteAddressField label="Куда" value={to} onChange={setTo} savedAddresses={savedAddresses} />
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button className="btn smallbtn" type="submit">{submitText}</button>
        <button className="btn smallbtn secondary" type="button" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

function FavoriteTaxiRoutesSection() {
  const [routes, setRoutes]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [msg, setMsg]               = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);

  const [adding, setAdding]         = useState(false);
  const [newLabel, setNewLabel]     = useState("");
  const [newFrom, setNewFrom]       = useState({ address: "", lat: null, lon: null });
  const [newTo, setNewTo]           = useState({ address: "", lat: null, lon: null });

  const [editId, setEditId]         = useState(null);
  const [editLabel, setEditLabel]   = useState("");
  const [editFrom, setEditFrom]     = useState({ address: "", lat: null, lon: null });
  const [editTo, setEditTo]         = useState({ address: "", lat: null, lon: null });

  useEffect(() => {
    fetchRoutes();
    fetch("/api/addresses", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setSavedAddresses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  async function fetchRoutes() {
    setLoading(true);
    try {
      const res = await fetch("/api/taxi/favorites", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Ошибка загрузки маршрутов");
      setRoutes(await res.json());
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newFrom.address || !newTo.address) {
      setMsg({ type: "err", text: "Укажите адреса Откуда и Куда" });
      return;
    }
    try {
      const token = await getCsrfToken();
      const res = await fetch("/api/taxi/favorites", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify({
          label: newLabel.trim() || null,
          fromAddress: newFrom.address, fromLat: newFrom.lat, fromLon: newFrom.lon,
          toAddress: newTo.address, toLat: newTo.lat, toLon: newTo.lon
        })
      });
      if (!res.ok) throw new Error("Ошибка при сохранении");
      setNewLabel(""); setNewFrom({ address: "", lat: null, lon: null }); setNewTo({ address: "", lat: null, lon: null });
      setAdding(false);
      setMsg({ type: "ok", text: "Маршрут добавлен!" });
      fetchRoutes();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    }
  }

  async function handleUpdate(id) {
    if (!editFrom.address || !editTo.address) {
      setMsg({ type: "err", text: "Укажите адреса Откуда и Куда" });
      return;
    }
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/taxi/favorites/${id}`, {
        method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify({
          label: editLabel.trim() || null,
          fromAddress: editFrom.address, fromLat: editFrom.lat, fromLon: editFrom.lon,
          toAddress: editTo.address, toLat: editTo.lat, toLon: editTo.lon
        })
      });
      if (!res.ok) throw new Error("Ошибка при обновлении");
      setEditId(null);
      setMsg({ type: "ok", text: "Маршрут обновлён!" });
      fetchRoutes();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    }
  }

  async function handleDelete(id) {
    try {
      const token = await getCsrfToken();
      const res = await fetch(`/api/taxi/favorites/${id}`, {
        method: "DELETE", credentials: "same-origin",
        headers: { "X-CSRF-TOKEN": token }
      });
      if (!res.ok) throw new Error("Ошибка при удалении");
      setMsg({ type: "ok", text: "Маршрут удалён!" });
      fetchRoutes();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    }
  }

  function startEdit(r) {
    setEditId(r.id);
    setEditLabel(r.label || "");
    setEditFrom({ address: r.fromAddress, lat: r.fromLat, lon: r.fromLon });
    setEditTo({ address: r.toAddress, lat: r.toLat, lon: r.toLon });
    setAdding(false);
  }

  return (
    <CollapsibleSection title="🚕 Избранные маршруты такси">
      <div className="block">
        {msg && (
          <div className={"msg " + (msg.type === "ok" ? "ok" : "err")} style={{ marginBottom: 12 }}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <p className="small">Загрузка...</p>
        ) : routes.length === 0 ? (
          <p className="small muted">Нет избранных маршрутов.</p>
        ) : (
          <div className="list">
            {routes.map(r => (
              <div key={r.id} className="list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                {editId === r.id ? (
                  <div style={{ width: "100%" }}>
                    <RouteForm
                      label={editLabel} setLabel={setEditLabel}
                      from={editFrom} setFrom={setEditFrom}
                      to={editTo} setTo={setEditTo}
                      onSubmit={e => { e.preventDefault(); handleUpdate(r.id); }}
                      onCancel={() => setEditId(null)}
                      submitText="Сохранить"
                      savedAddresses={savedAddresses}
                    />
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", gap: 12 }}>
                    <a
                      href={`/taxi?fromAddress=${encodeURIComponent(r.fromAddress)}&fromLat=${r.fromLat || ""}&fromLon=${r.fromLon || ""}&toAddress=${encodeURIComponent(r.toAddress)}&toLat=${r.toLat || ""}&toLon=${r.toLon || ""}`}
                      style={{ flex: 1, textDecoration: "none", color: "inherit" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 16 }}>🚕</span>
                        <b>{r.label || (r.fromAddress + " → " + r.toAddress)}</b>
                      </div>
                      <div className="small muted" style={{ marginTop: 2 }}>
                        📍 {r.fromAddress} → {r.toAddress}
                      </div>
                    </a>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn smallbtn secondary" onClick={() => startEdit(r)}>✏️</button>
                      <button className="btn smallbtn secondary" onClick={() => handleDelete(r.id)}>🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          {adding ? (
            <RouteForm
              label={newLabel} setLabel={setNewLabel}
              from={newFrom} setFrom={setNewFrom}
              to={newTo} setTo={setNewTo}
              onSubmit={handleAdd}
              onCancel={() => { setAdding(false); setNewLabel(""); setNewFrom({ address: "", lat: null, lon: null }); setNewTo({ address: "", lat: null, lon: null }); }}
              submitText="Добавить"
              savedAddresses={savedAddresses}
            />
          ) : (
            <button className="btn smallbtn" onClick={() => { setAdding(true); setEditId(null); }}>+ Добавить маршрут</button>
          )}
        </div>
      </div>
    </CollapsibleSection>
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
        <FavoriteTaxiRoutesSection />

      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProfilePage />);