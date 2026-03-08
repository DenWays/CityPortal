const { useEffect, useState, useRef, useCallback } = React;

const DEFAULT_CENTER = [51.7727, 55.1039];
const DEFAULT_ZOOM   = 13;

function SavedMessage({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ fontSize: 13, color: "#4ade80", marginTop: 6 }}>✓ Добавлено в избранное!</div>
  );
}

function PointPopup({ point, onClose, onSaved, isLoggedIn }) {
  const [phase, setPhase]     = useState("idle");
  const [label, setLabel]     = useState("");
  const [addMode, setAddMode] = useState(false);
  const [errMsg, setErrMsg]   = useState("");

  if (!point) return null;

  async function getCsrf() {
    const r = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
    const d = await r.json();
    return d.token;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setPhase("saving");
    try {
      const token = await getCsrf();
      const res = await fetch("/api/addresses", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
        body: JSON.stringify({ label: label.trim(), address: point.address, lat: point.lat, lon: point.lon })
      });
      if (res.status === 401 || res.status === 403) throw new Error("Нужно войти в аккаунт");
      if (!res.ok) throw new Error("Ошибка сохранения");
      setPhase("saved");
      setAddMode(false);
      onSaved && onSaved();
    } catch (e) {
      setErrMsg(e.message);
      setPhase("error");
    }
  }

  return (
    <div style={{
      position: "absolute", bottom: 24, left: 8,
      zIndex: 500, minWidth: 260, maxWidth: 320,
      background: "rgba(15,17,30,0.97)", border: "1px solid rgba(255,255,255,0.13)",
      borderRadius: 16, padding: "16px 18px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      backdropFilter: "blur(12px)"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>
            📍 ВЫБРАННАЯ ТОЧКА
          </div>
          {point.name && (
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{point.name}</div>
          )}
          <div style={{ fontSize: 13, fontWeight: point.name ? 400 : 600, lineHeight: 1.4, color: point.name ? "rgba(255,255,255,0.75)" : "#fff" }}>{point.address}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
            {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.4)", fontSize: 18, padding: 0, flexShrink: 0, lineHeight: 1
        }}>✕</button>
      </div>

      {/* Action buttons — shown when not in any mode and not yet saved */}
      {!addMode && phase !== "saved" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isLoggedIn && (
            <button
              className="btn smallbtn"
              style={{ marginTop: 0, background: "rgba(251,191,36,0.15)", borderColor: "rgba(251,191,36,0.35)", color: "#fbbf24" }}
              onClick={() => { setAddMode(true); setPhase("idle"); setErrMsg(""); setLabel(""); }}
            >
              ⭐ В избранное
            </button>
          )}
          {!isLoggedIn && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>⭐</span>
              <span>
                <a href="/login" style={{ color: "#fbbf24", textDecoration: "underline" }}>Войдите</a>, чтобы добавить в избранное
              </span>
            </div>
          )}
          <button
            className="btn smallbtn secondary"
            style={{ marginTop: 0 }}
            onClick={() => alert("Построение маршрута — скоро!")}
          >
            🗺️ Как добраться
          </button>
          <button
            className="btn smallbtn"
            style={{ marginTop: 0, background: "rgba(252,200,0,0.15)", borderColor: "rgba(252,200,0,0.35)", color: "#fcd34d" }}
            onClick={() => {
              const params = new URLSearchParams({ toAddress: point.address, toLat: point.lat, toLon: point.lon });
              window.location.href = `/taxi?${params.toString()}`;
            }}
          >
            🚕 Заказать такси
          </button>
        </div>
      )}

      {/* Add-to-favourites inline form */}
      {addMode === true && phase !== "saved" && (
        <form onSubmit={handleSave} style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="input"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Название (Дом, Работа…)"
            autoFocus
            style={{ padding: "8px 12px", fontSize: 13 }}
          />
          {phase === "error" && <div style={{ fontSize: 12, color: "#f87171" }}>{errMsg}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn smallbtn" type="submit" style={{ marginTop: 0 }} disabled={phase === "saving"}>
              {phase === "saving" ? "…" : "Сохранить"}
            </button>
            <button className="btn smallbtn secondary" type="button" style={{ marginTop: 0 }}
              onClick={() => { setAddMode(false); setPhase("idle"); }}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Success message — auto-disappears after 2s */}
      {phase === "saved" && (
        <SavedMessage onDone={() => { setPhase("idle"); setAddMode(false); }} />
      )}
    </div>
  );
}

function MapPage() {
  const [mapReady, setMapReady]             = useState(false);
  const [mapError, setMapError]             = useState(null);
  const [query, setQuery]                   = useState("");
  const [results, setResults]               = useState([]);
  const [searching, setSearching]           = useState(false);
  const [searchError, setSearchError]       = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [clickedPoint, setClickedPoint]     = useState(null); // { lat, lon, address }
  const [isLoggedIn, setIsLoggedIn]         = useState(false);

  const mapRef        = useRef(null);
  const markerRef     = useRef(null);
  const clickMarkerRef = useRef(null);
  const favMarkersRef = useRef([]);
  const debounceRef   = useRef(null);
  const inputWrapRef  = useRef(null);

  useEffect(() => {
    fetch("/api/addresses", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setSavedAddresses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/account", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsLoggedIn(!!data))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/maps/js-key");
        if (!res.ok) throw new Error("Не удалось получить ключ карты");
        const key = await res.text();
        const script = document.createElement("script");
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
        script.async = true;
        script.onload = () => { window.ymaps.ready(() => setMapReady(true)); };
        script.onerror = () => setMapError("Не удалось загрузить Яндекс Карты");
        document.head.appendChild(script);
      } catch (e) {
        setMapError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const placeFavouriteMarkers = useCallback(async (map, addresses) => {
    if (!map || !window.ymaps) return;
    favMarkersRef.current.forEach(m => map.geoObjects.remove(m));
    favMarkersRef.current = [];
    for (const fav of addresses) {
      let lat = fav.lat, lon = fav.lon;
      if (!lat || !lon) {
        try {
          const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent("Оренбург, " + fav.address)}`, { credentials: "same-origin" });
          const json = await res.json();
          const items = json?.response?.GeoObjectCollection?.featureMember ?? [];
          if (items.length > 0) {
            const pos = items[0].GeoObject.Point.pos.split(" ").map(Number);
            lon = pos[0]; lat = pos[1];
          }
        } catch { continue; }
      }
      if (!lat || !lon) continue;
      const marker = new window.ymaps.Placemark(
        [lat, lon],
        { balloonContent: `<b>${fav.label}</b><br/>${fav.address}`, hintContent: fav.label },
        { preset: "islands#yellowStarIcon" }
      );
      map.geoObjects.add(marker);
      favMarkersRef.current.push(marker);
    }
  }, []);

  function placeClickMarker(lat, lon, name) {
    window.ymaps.geocode([lat, lon], { results: 1 }).then(res => {
      const geoObj = res.geoObjects.get(0);

      let address = null;
      try {
        const comps = geoObj?.properties?.getAll()
          ?.metaDataProperty?.GeocoderMetaData?.Address?.Components;
        if (Array.isArray(comps)) {
          const street = comps.find(c => c.kind === "street");
          const house  = comps.find(c => c.kind === "house");
          if (street && house) address = `${street.name}, ${house.name}`;
          else if (street)     address = street.name;
        }
      } catch (_) {}

      if (!address) {
        try {
          const full = geoObj?.getAddressLine() || "";
          const parts = full.split(",").map(s => s.trim()).filter(Boolean);
          const skipRe = /россия|область|край|округ|республика/i;
          let i = 0;
          while (i < parts.length && skipRe.test(parts[i])) i++;
          if (i < parts.length - 1 && !/\d/.test(parts[i])) i++;
          const trimmed = parts.slice(i).join(", ");
          if (trimmed && !/^[\d .,\-]+$/.test(trimmed)) address = trimmed;
        } catch (_) {}
      }

      if (!address) address = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

      const finalName = (name && name !== address) ? name : null;

      if (clickMarkerRef.current && mapRef.current)
        mapRef.current.geoObjects.remove(clickMarkerRef.current);
      clickMarkerRef.current = new window.ymaps.Placemark(
        [lat, lon],
        { hintContent: address },
        { preset: "islands#blueDotIcon" }
      );
      mapRef.current.geoObjects.add(clickMarkerRef.current);
      setClickedPoint({ lat, lon, address, name: finalName });
    });
  }

  useEffect(() => {
    if (!mapReady || mapRef.current) return;
    mapRef.current = new window.ymaps.Map("ymap-container", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      controls: ["zoomControl", "fullscreenControl", "geolocationControl"]
    });

    let lastCoords = null;
    mapRef.current.events.add("mousedown", (e) => {
      lastCoords = e.get("coords");
    });

    mapRef.current.events.add("click", (e) => {
      const [lat, lon] = e.get("coords");
      placeClickMarker(lat, lon);
    });

    mapRef.current.balloon.events.add("open", () => {
      try {
        if (!lastCoords) return;
        const [lat, lon] = lastCoords;

        let name = null;
        const balloonEl = document.querySelector("[class*='balloon__content']");
        if (balloonEl) {
          const heading = balloonEl.querySelector("h1, h2, h3, b, strong, [class*='title'], [class*='name']");
          if (heading) name = heading.textContent.trim() || null;
          if (!name) {
            const first = balloonEl.textContent.trim().split(/[\n\r]+/)[0].trim();
            if (first.length > 1 && first.length < 120) name = first;
          }
        }

        placeClickMarker(lat, lon, name);
      } catch (_) {}
    });

    mapRef.current.balloon.events.add("close", () => {
      setClickedPoint(null);
    });
  }, [mapReady]);

  useEffect(() => {
    if (mapReady && mapRef.current) {
      placeFavouriteMarkers(mapRef.current, savedAddresses);
    }
  }, [mapReady, savedAddresses, placeFavouriteMarkers]);

  function handlePopupClose() {
    setClickedPoint(null);
    if (clickMarkerRef.current && mapRef.current) {
      mapRef.current.geoObjects.remove(clickMarkerRef.current);
      clickMarkerRef.current = null;
    }
    try { if (mapRef.current?.balloon.isOpen()) mapRef.current.balloon.close(); } catch (_) {}
  }

  function handlePopupSaved() {
    fetch("/api/addresses", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setSavedAddresses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }

  const searchGeocode = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setDropdownOpen(false); return; }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Ошибка геокодера");
      const data = await res.json();
      const members = data?.response?.GeoObjectCollection?.featureMember ?? [];
      const mapped = members.map(m => {
        const obj = m.GeoObject;
        const pos = obj.Point.pos.split(" ").map(Number);
        return {
          name: obj.metaDataProperty?.GeocoderMetaData?.text ?? "Без названия",
          coords: [pos[1], pos[0]]
        };
      });
      const filtered = mapped.filter(r => r.name.toLowerCase().includes("оренбург"));
      setResults(filtered);
      setDropdownOpen(true);
    } catch (e) {
      setSearchError(e.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setDropdownOpen(false); return; }
    debounceRef.current = setTimeout(() => searchGeocode(val), 400);
  };

  const favMatches = (query.length >= 2 && savedAddresses.length > 0)
    ? savedAddresses.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.address.toLowerCase().includes(query.toLowerCase()))
    : [];

  const closeDropdown = () => { setDropdownOpen(false); };

  const handleSelectFav = async (fav) => {
    setQuery(fav.address);
    closeDropdown();
    if (!mapRef.current) return;
    let lat = fav.lat, lon = fav.lon;
    if (!lat || !lon) {
      try {
        const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent("Оренбург, " + fav.address)}`, { credentials: "same-origin" });
        const json = await res.json();
        const items = json?.response?.GeoObjectCollection?.featureMember ?? [];
        if (items.length > 0) {
          const pos = items[0].GeoObject.Point.pos.split(" ").map(Number);
          lon = pos[0]; lat = pos[1];
        }
      } catch { return; }
    }
    if (!lat || !lon) return;
    if (markerRef.current) mapRef.current.geoObjects.remove(markerRef.current);
    markerRef.current = new window.ymaps.Placemark([lat, lon], {
      balloonContent: `<b>${fav.label}</b><br/>${fav.address}`
    }, { preset: "islands#yellowStarIcon" });
    mapRef.current.geoObjects.add(markerRef.current);
    mapRef.current.setCenter([lat, lon], 15, { duration: 500 });
    markerRef.current.balloon.open();
  };

  const handleSelect = (item) => {
    setQuery(item.name);
    closeDropdown();
    if (!mapRef.current) return;
    if (markerRef.current) mapRef.current.geoObjects.remove(markerRef.current);
    markerRef.current = new window.ymaps.Placemark(item.coords, {
      balloonContent: item.name
    }, { preset: "islands#redDotIcon" });
    mapRef.current.geoObjects.add(markerRef.current);
    mapRef.current.setCenter(item.coords, 15, { duration: 500 });
    markerRef.current.balloon.open();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    searchGeocode(query);
  };

  const showDropdown = dropdownOpen && (favMatches.length > 0 || results.length > 0);

  return (
    <div className="home">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo small" />
          <div>
            <div className="topbar-title">CityPortal</div>
            <div className="topbar-subtitle">Карта города</div>
          </div>
        </div>
        <div className="topbar-right">
          <a className="btn smallbtn secondary" href="/">← На главную</a>
        </div>
      </header>

      <main className="main">
        <section className="section" style={{ paddingBottom: 0 }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, position: "relative", alignItems: "flex-start" }}>
            <div ref={inputWrapRef} style={{ position: "relative", flex: "1 1 0", minWidth: 0 }}>
              <input
                type="text"
                className="input"
                placeholder="Введите адрес или место..."
                value={query}
                onChange={handleInput}
                autoComplete="off"
                style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", fontSize: 15, borderRadius: 14 }}
              />
              {showDropdown && (
                <ul style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "var(--bg2, #1e1e2e)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8, margin: 0, padding: 0, listStyle: "none",
                  zIndex: 100, maxHeight: 320, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
                }}>
                  {favMatches.length > 0 && (
                    <>
                      <li style={{ padding: "6px 14px 4px", fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5, borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "default" }}>
                        ⭐ ИЗБРАННЫЕ АДРЕСА
                      </li>
                      {favMatches.map((fav, i) => (
                        <li key={"fav-" + i} onMouseDown={() => handleSelectFav(fav)}
                          style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14 }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(251,191,36,0.10)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><span>⭐</span>{fav.label}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{fav.address}</div>
                        </li>
                      ))}
                    </>
                  )}
                  {results.map((r, i) => (
                    <li key={i} onMouseDown={() => handleSelect(r)}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 14, color: "var(--text, #cdd6f4)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {r.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="submit" className="btn primary" disabled={searching}
              style={{ marginTop: 0, padding: "14px 24px", fontSize: 15, borderRadius: 14, whiteSpace: "nowrap", width: "auto", flexShrink: 0 }}>
              {searching ? "..." : "Найти"}
            </button>
          </form>
          {searchError && <div className="msg err" style={{ marginTop: 8 }}>{searchError}</div>}
        </section>

        <section className="section">
          {mapError && <div className="msg err">{mapError}</div>}
          {!mapReady && !mapError && (
            <div className="block" style={{ textAlign: "center", padding: 40 }}>
              <span className="muted">Загрузка карты...</span>
            </div>
          )}
          {/* Map container — position:relative so popup anchors to it */}
          <div style={{ position: "relative" }}>
            <div
              id="ymap-container"
              style={{
                width: "100%", height: "560px", borderRadius: 12, overflow: "hidden",
                display: mapReady ? "block" : "none",
                border: "1px solid rgba(255,255,255,0.10)"
              }}
            />
            <PointPopup point={clickedPoint} onClose={handlePopupClose} onSaved={handlePopupSaved} isLoggedIn={isLoggedIn} />
          </div>
        </section>

        <footer className="footer" style={{ marginTop: 24 }}>
          <span>© CityPortal</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MapPage />);