const { useEffect, useState } = React;

function iconEmoji(name) {
  const map = {
    "clear-day": "☀️", "clear-night": "🌙",
    "mostly-clear-day": "🌤️", "mostly-clear-night": "🌤️",
    "partly-cloudy-day": "⛅", "partly-cloudy-night": "☁️",
    "overcast-day": "☁️", "overcast-night": "☁️",
    "fog-day": "🌫️", "fog-night": "🌫️", "rime-fog": "🌫️",
    "drizzle": "🌦️", "extreme-drizzle": "🌧️",
    "freezing-drizzle": "🌨️", "freezing-rain": "🌨️",
    "partly-cloudy-day-rain": "🌦️", "partly-cloudy-night-rain": "🌦️",
    "rain": "🌧️", "extreme-rain": "🌧️",
    "partly-cloudy-day-snow": "🌨️", "partly-cloudy-night-snow": "🌨️",
    "snow": "❄️", "extreme-snow": "❄️", "snowflake": "❄️",
    "thunderstorms-day": "⛈️", "thunderstorms-night": "⛈️",
    "thunderstorms-day-rain": "⛈️", "thunderstorms-night-rain": "⛈️",
    "thunderstorms-rain": "⛈️", "thunderstorms-extreme-rain": "⛈️",
    "not-available": "🌡️"
  };
  return map[name] || "🌡️";
}

function WeatherIcon({ name, className }) {
  const sizeMap = {
    "weather-icon-big": "3rem",
    "weather-icon-sm": "1.6rem",
    "weather-detail-icon": "5rem",
  };
  const fontSize = sizeMap[className] || "2rem";
  return <span style={{ fontSize, lineHeight: 1 }}>{iconEmoji(name)}</span>;
}

function Widget({ title, children }) {
  return (
    <div className="widget">
      <div className="widget-title">{title}</div>
      <div className="widget-body">{children}</div>
    </div>
  );
}

function formatHour(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

function WeatherWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/weather/details");
        if (!res.ok) throw new Error("Ошибка загрузки погоды");
        setData(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="widget weather-widget">
      <div className="widget-title">🌤 Погода</div>
      <div className="widget-body"><span className="small muted">Загрузка...</span></div>
    </div>
  );

  if (error) return (
    <div className="widget weather-widget">
      <div className="widget-title">🌤 Погода</div>
      <div className="widget-body"><span className="small" style={{color:"var(--danger)"}}>{error}</span></div>
    </div>
  );

  const { current, hourly, daily } = data;

  return (
    <a href="/weather" className="widget weather-widget widget-link">
      <div className="widget-title">🌤 Погода — {current.city}</div>
      <div className="widget-body">

        {/* Текущая погода */}
        <div className="weather-current">
          <div className="weather-main">
            <WeatherIcon name={current.icon} className="weather-icon-big" />
            <div>
              <div className="weather-temp">{Math.round(current.tempC)}°C</div>
              <div className="small">{current.description}</div>
            </div>
          </div>
          <div className="weather-feels">
            <span className="small muted">Ощущается как</span>
            <span className="small"> {Math.round(current.feelsLikeC)}°C</span>
          </div>
        </div>

        {/* Почасовой прогноз (превью — 6 часов) */}
        <div className="weather-scroll">
          {hourly.slice(0, 6).map((h, i) => (
            <div key={i} className="weather-scroll-item">
              <div className="small muted">{formatHour(h.time)}</div>
              <WeatherIcon name={h.icon} className="weather-icon-sm" />
              <div className="small" style={{fontWeight:700}}>{Math.round(h.tempC)}°</div>
            </div>
          ))}
          <div className="weather-scroll-item weather-scroll-more">
            <span className="small muted">Подробнее →</span>
          </div>
        </div>

      </div>
    </a>
  );
}

// ── Auto-disappearing success message ────────────────────────────────────────
function SavedMessage({ onDone }) {
  React.useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4 }}>✓ Добавлено в избранное!</div>
  );
}

// ── Popup shown when user clicks on the map ──────────────────────────────────
function PointPopup({ point, onClose, onSaved, isLoggedIn }) {
  const [phase, setPhase]     = React.useState("idle");
  const [label, setLabel]     = React.useState("");
  const [addMode, setAddMode] = React.useState(false);
  const [errMsg, setErrMsg]   = React.useState("");

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
      position: "absolute", bottom: 16, left: 8,
      zIndex: 500, minWidth: 220, maxWidth: 290,
      background: "rgba(15,17,30,0.97)", border: "1px solid rgba(255,255,255,0.13)",
      borderRadius: 14, padding: "12px 14px", boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      backdropFilter: "blur(12px)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>📍 ВЫБРАННАЯ ТОЧКА</div>
          {point.name && (
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{point.name}</div>
          )}
          <div style={{ fontSize: 12, fontWeight: point.name ? 400 : 600, lineHeight: 1.4, color: point.name ? "rgba(255,255,255,0.75)" : "#fff" }}>{point.address}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{point.lat.toFixed(5)}, {point.lon.toFixed(5)}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
      </div>
      {!addMode && phase !== "saved" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {isLoggedIn && (
            <button className="btn smallbtn" style={{ marginTop: 0, fontSize: 11, padding: "5px 10px", background: "rgba(251,191,36,0.15)", borderColor: "rgba(251,191,36,0.35)", color: "#fbbf24" }}
              onClick={() => { setAddMode(true); setPhase("idle"); setErrMsg(""); setLabel(""); }}>
              ⭐ В избранное
            </button>
          )}
          {!isLoggedIn && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 5 }}>
              <span>⭐</span>
              <span><a href="/login" style={{ color: "#fbbf24", textDecoration: "underline" }}>Войдите</a>, чтобы добавить в избранное</span>
            </div>
          )}
          <button className="btn smallbtn secondary" style={{ marginTop: 0, fontSize: 11, padding: "5px 10px" }}
            onClick={() => alert("Построение маршрута — скоро!")}>
            🗺️ Как добраться
          </button>
          <button className="btn smallbtn" style={{ marginTop: 0, fontSize: 11, padding: "5px 10px", background: "rgba(252,200,0,0.15)", borderColor: "rgba(252,200,0,0.35)", color: "#fcd34d" }}
            onClick={() => {
              const params = new URLSearchParams({ toAddress: point.address, toLat: point.lat, toLon: point.lon });
              window.location.href = `/taxi?${params.toString()}`;
            }}>
            🚕 Заказать такси
          </button>
        </div>
      )}
      {addMode === true && phase !== "saved" && (
        <form onSubmit={handleSave} style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          <input className="input" value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Название (Дом, Работа…)" autoFocus style={{ padding: "7px 10px", fontSize: 12 }} />
          {phase === "error" && <div style={{ fontSize: 11, color: "#f87171" }}>{errMsg}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn smallbtn" type="submit" style={{ marginTop: 0, fontSize: 11, padding: "5px 10px" }} disabled={phase === "saving"}>
              {phase === "saving" ? "…" : "Сохранить"}
            </button>
            <button className="btn smallbtn secondary" type="button" style={{ marginTop: 0, fontSize: 11, padding: "5px 10px" }}
              onClick={() => { setAddMode(false); setPhase("idle"); }}>Отмена</button>
          </div>
        </form>
      )}
      {phase === "saved" && (
        <SavedMessage onDone={() => { setPhase("idle"); setAddMode(false); }} />
      )}
    </div>
  );
}

function MapWidget() {
  const [mapReady, setMapReady]             = useState(false);
  const [mapError, setMapError]             = useState(null);
  const [query, setQuery]                   = useState("");
  const [results, setResults]               = useState([]);
  const [searching, setSearching]           = useState(false);
  const [searchError, setSearchError]       = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [clickedPoint, setClickedPoint]     = useState(null);
  const [isLoggedIn, setIsLoggedIn]         = useState(false);

  const mapRef         = React.useRef(null);
  const initDone       = React.useRef(false);
  const markerRef      = React.useRef(null);
  const clickMarkerRef = React.useRef(null);
  const favMarkersRef  = React.useRef([]);
  const debounceRef    = React.useRef(null);
  const inputWrapRef   = React.useRef(null);

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
    const handler = (e) => {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (window._ymapsLoaded) {
      window.ymaps.ready(() => setMapReady(true));
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/maps/js-key");
        if (!res.ok) throw new Error("Не удалось получить ключ карты");
        const key = await res.text();
        const script = document.createElement("script");
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
        script.async = true;
        script.onload = () => {
          window._ymapsLoaded = true;
          window.ymaps.ready(() => setMapReady(true));
        };
        script.onerror = () => setMapError("Не удалось загрузить Яндекс Карты");
        document.head.appendChild(script);
      } catch (e) {
        setMapError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!mapReady || initDone.current) return;
    initDone.current = true;
    mapRef.current = new window.ymaps.Map("ymap-widget-container", {
      center: [51.7727, 55.1039],
      zoom: 12,
      controls: ["zoomControl", "geolocationControl"]
    });

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
        if (clickMarkerRef.current) mapRef.current.geoObjects.remove(clickMarkerRef.current);
        clickMarkerRef.current = new window.ymaps.Placemark([lat, lon],
          { hintContent: address }, { preset: "islands#blueDotIcon" }
        );
        mapRef.current.geoObjects.add(clickMarkerRef.current);
        setClickedPoint({ lat, lon, address, name: finalName });
      });
    }

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

  const placeFavMarkers = React.useCallback(async (map, addresses) => {
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

  useEffect(() => {
    if (mapReady && mapRef.current) {
      placeFavMarkers(mapRef.current, savedAddresses);
    }
  }, [mapReady, savedAddresses, placeFavMarkers]);

  const doSearch = async (q) => {
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
        return { name: obj.metaDataProperty?.GeocoderMetaData?.text ?? "Без названия", coords: [pos[1], pos[0]] };
      });
      setResults(mapped.filter(r => r.name.toLowerCase().includes("оренбург")));
      setDropdownOpen(true);
    } catch (e) {
      setSearchError(e.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setDropdownOpen(false); return; }
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const favMatches = (query.length >= 2 && savedAddresses.length > 0)
    ? savedAddresses.filter(a =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.address.toLowerCase().includes(query.toLowerCase()))
    : [];

  const showDropdown = dropdownOpen && (favMatches.length > 0 || results.length > 0);

  const handleSelectFav = async (fav) => {
    setQuery(fav.address);
    setDropdownOpen(false);
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
    markerRef.current = new window.ymaps.Placemark([lat, lon],
      { balloonContent: `<b>${fav.label}</b><br/>${fav.address}` },
      { preset: "islands#yellowStarIcon" }
    );
    mapRef.current.geoObjects.add(markerRef.current);
    mapRef.current.setCenter([lat, lon], 15, { duration: 500 });
    markerRef.current.balloon.open();
  };

  const handleSelect = (item) => {
    setQuery(item.name);
    setDropdownOpen(false);
    if (!mapRef.current) return;
    if (markerRef.current) mapRef.current.geoObjects.remove(markerRef.current);
    markerRef.current = new window.ymaps.Placemark(item.coords, { balloonContent: item.name }, { preset: "islands#redDotIcon" });
    mapRef.current.geoObjects.add(markerRef.current);
    mapRef.current.setCenter(item.coords, 15, { duration: 500 });
    markerRef.current.balloon.open();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    doSearch(query);
  };

  return (
    <div className="widget map-widget">
      <div className="widget-title">🗺️ Карта города</div>
      <div className="widget-body">

        {/* Геокодер */}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <div ref={inputWrapRef} style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              className="input"
              placeholder="Найти место на карте..."
              value={query}
              onChange={handleInput}
              autoComplete="off"
              style={{ padding: "8px 10px", fontSize: 13 }}
            />
            {showDropdown && (
              <ul style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                background: "rgba(11,18,32,0.97)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, margin: 0, padding: 0, listStyle: "none",
                zIndex: 200, maxHeight: 220, overflowY: "auto",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
              }}>
                {/* Favourite matches */}
                {favMatches.length > 0 && (
                  <>
                    <li style={{
                      padding: "5px 12px 3px", fontSize: 10,
                      color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5,
                      borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "default"
                    }}>⭐ ИЗБРАННЫЕ</li>
                    {favMatches.map((fav, i) => (
                      <li key={"fav-" + i} onMouseDown={() => handleSelectFav(fav)} style={{
                        padding: "8px 12px", cursor: "pointer", fontSize: 12,
                        borderBottom: "1px solid rgba(255,255,255,0.06)"
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(251,191,36,0.10)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                          <span>⭐</span>{fav.label}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>{fav.address}</div>
                      </li>
                    ))}
                  </>
                )}
                {/* Geocode results */}
                {results.map((r, i) => (
                  <li key={i} onMouseDown={() => handleSelect(r)} style={{
                    padding: "8px 12px", cursor: "pointer", fontSize: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    color: "var(--text)"
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >{r.name}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="btn smallbtn" disabled={searching} style={{ marginTop: 0, padding: "8px 12px", fontSize: 12 }}>
            {searching ? "..." : "🔍"}
          </button>
        </form>
        {searchError && <div className="small" style={{ color: "var(--danger)", marginBottom: 6 }}>{searchError}</div>}
        {mapError && <div className="small" style={{ color: "var(--danger)", marginBottom: 6 }}>{mapError}</div>}
        {!mapReady && !mapError && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <span className="small muted">Загрузка карты...</span>
          </div>
        )}

        <div style={{ position: "relative" }}>
          <div
            id="ymap-widget-container"
            style={{
              width: "100%",
              borderRadius: 10,
              overflow: "hidden",
              display: mapReady ? "block" : "none",
              border: "1px solid rgba(255,255,255,0.10)"
            }}
          />
          <PointPopup point={clickedPoint} onClose={handlePopupClose} onSaved={handlePopupSaved} isLoggedIn={isLoggedIn} />
        </div>

        <div style={{ marginTop: 8, textAlign: "right" }}>
          <a className="btn smallbtn secondary" href="/map" style={{ display: "inline-block" }}>
            Открыть карту →
          </a>
        </div>
      </div>
    </div>
  );
}

function TrafficWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/traffic/widget");
        if (!res.ok) throw new Error("Ошибка загрузки пробок");
        setData(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="widget">
      <div className="widget-title">🚦 Пробки</div>
      <div className="widget-body"><span className="small muted">Загрузка...</span></div>
    </div>
  );
  if (error) return (
    <div className="widget">
      <div className="widget-title">🚦 Пробки</div>
      <div className="widget-body"><span className="small" style={{color:"var(--danger)"}}>{error}</span></div>
    </div>
  );

  const levelColors = ["#6b7280","#22c55e","#22c55e","#84cc16","#84cc16","#f59e0b","#f59e0b","#ef4444","#ef4444","#dc2626","#7f1d1d"];
  const color = levelColors[data.level] || "#6b7280";

  return (
    <a href="/traffic" className="widget widget-link">
      <div className="widget-title">🚦 Пробки — {data.city}</div>
      <div className="widget-body">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: "2.4rem", lineHeight: 1 }}>{data.icon}</span>
          <div>
            <div className="big" style={{ color, lineHeight: 1 }}>{data.level}/10</div>
            <div className="small" style={{ marginTop: 2 }}>{data.description}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 8, borderRadius: 3,
              background: i < data.level ? color : "rgba(255,255,255,0.08)"
            }} />
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>Нажмите, чтобы открыть карту пробок →</div>
      </div>
    </a>
  );
}

function TaxiWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/taxi/widget");
        if (!res.ok) throw new Error("Ошибка загрузки такси");
        setData(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="widget">
      <div className="widget-title">🚕 Такси</div>
      <div className="widget-body"><span className="small muted">Загрузка...</span></div>
    </div>
  );

  if (error || !data || data.status === "unavailable") return (
    <a href="/taxi" className="widget widget-link">
      <div className="widget-title">🚕 Такси — Оренбург</div>
      <div className="widget-body">
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>🚕</div>
        <div className="small muted">Открыть сервис такси →</div>
      </div>
    </a>
  );

  const priceText = data.minPrice != null
    ? (data.minPrice === data.maxPrice ? `~${data.minPrice} ₽` : `~${data.minPrice}–${data.maxPrice} ₽`)
    : "—";

  return (
    <a href="/taxi" className="widget widget-link">
      <div className="widget-title">🚕 Такси — {data.city}</div>
      <div className="widget-body">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <span style={{ fontSize: "2.4rem", lineHeight: 1 }}>🚕</span>
          <div>
            <div className="big" style={{ color: "#fbbf24", lineHeight: 1 }}>{priceText}</div>
            <div className="small" style={{ marginTop: 2 }}>
              {data.waitingTimeMinutes != null ? `Подача: ${data.waitingTimeMinutes} мин` : "Яндекс GO"}
            </div>
          </div>
        </div>
        <div className="small muted" style={{ marginBottom: 6 }}>пр. Победы, 13 → пр. Победы, 178/1</div>
        <div className="small muted" style={{ marginBottom: 10 }}>Нажмите, чтобы рассчитать маршрут →</div>
        {data.deepLink && (
          <a
            href={data.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px",
              background: "linear-gradient(135deg, #fc0, #ff8c00)",
              borderRadius: 10, textDecoration: "none", color: "#1a1a1a",
              fontWeight: 700, fontSize: 13,
              boxShadow: "0 2px 10px rgba(255,200,0,0.2)"
            }}
          >
            Перейти в Яндекс GO
          </a>
        )}
      </div>
    </a>
  );
}

function CityTabs() {
  const [activeTab, setActiveTab] = useState("news");
  const [visible, setVisible] = useState(true);

  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  const switchTab = (id) => {
    if (id === activeTab) return;
    setVisible(false);
    setTimeout(() => { setActiveTab(id); setVisible(true); }, 160);
  };

  useEffect(() => {
    setNewsLoading(true);
    setNewsError(null);
    fetch("/api/news?page=0&size=5")
      .then(r => { if (!r.ok) throw new Error("Ошибка загрузки новостей"); return r.json(); })
      .then(data => setNews(data.content || []))
      .catch(e => setNewsError(e.message))
      .finally(() => setNewsLoading(false));
  }, []);

  useEffect(() => {
    setEventsLoading(true);
    setEventsError(null);
    fetch("/api/afisha?page=0&size=5")
      .then(r => { if (!r.ok) throw new Error("Ошибка загрузки афиши"); return r.json(); })
      .then(data => setEvents(data.content || []))
      .catch(e => setEventsError(e.message))
      .finally(() => setEventsLoading(false));
  }, []);

  const tabs = [
    { id: "news",   label: "📰 Новости" },
    { id: "afisha", label: "🎭 Афиша" },
    { id: "places", label: "🏠 Заведения" },
    { id: "routes", label: "🗺️ Маршруты" },
  ];

  return (
    <section className="section">
      <div className="city-tabs-bar">
        {tabs.map(t => (
          <button
            key={t.id}
            className={"city-tab-btn" + (activeTab === t.id ? " active" : "")}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="block" style={{ marginTop: 10, opacity: visible ? 1 : 0, transition: "opacity 0.16s" }}>

        {activeTab === "news" && (
          <div>
            {newsLoading && <div className="small muted" style={{padding:"12px 0"}}>Загрузка новостей...</div>}
            {newsError && <div className="small" style={{color:"var(--danger)",padding:"12px 0"}}>{newsError}</div>}
            {!newsLoading && !newsError && news.length === 0 && (
              <div className="small muted" style={{padding:"12px 0"}}>Новостей пока нет</div>
            )}
            {news.map(item => (
              <a key={item.id} href={"/news/" + item.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 4px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                textDecoration: "none", color: "inherit",
                borderRadius: 8, transition: "background 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" style={{
                    width: 64, height: 48, objectFit: "cover",
                    borderRadius: 6, flexShrink: 0, background: "rgba(255,255,255,0.05)"
                  }} onError={e => e.currentTarget.style.display = "none"} />
                ) : (
                  <div style={{
                    width: 64, height: 48, borderRadius: 6, flexShrink: 0,
                    background: "rgba(255,255,255,0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem"
                  }}>📰</div>
                )}
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontWeight: 600, fontSize: 13, lineHeight: 1.4,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical"
                  }}>{item.title}</div>
                  <div className="small muted" style={{marginTop: 3}}>
                    {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("ru-RU") : ""}
                  </div>
                </div>
              </a>
            ))}
            <div style={{marginTop:10, textAlign:"right"}}>
              <a className="btn smallbtn secondary" href="/news">Все новости →</a>
            </div>
          </div>
        )}

        {activeTab === "afisha" && (
          <div>
            {eventsLoading && <div className="small muted" style={{padding:"12px 0"}}>Загрузка афиши...</div>}
            {eventsError && <div className="small" style={{color:"var(--danger)",padding:"12px 0"}}>{eventsError}</div>}
            {!eventsLoading && !eventsError && events.length === 0 && (
              <div className="small muted" style={{padding:"12px 0"}}>Мероприятий пока нет</div>
            )}
            {events.map(item => (
              <a key={item.id} href={item.sourceUrl || "/afisha"} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 4px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                textDecoration: "none", color: "inherit",
                borderRadius: 8, transition: "background 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" style={{
                    width: 64, height: 48, objectFit: "cover",
                    borderRadius: 6, flexShrink: 0, background: "rgba(255,255,255,0.05)"
                  }} onError={e => e.currentTarget.style.display = "none"} />
                ) : (
                  <div style={{
                    width: 64, height: 48, borderRadius: 6, flexShrink: 0,
                    background: "rgba(124,58,237,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem"
                  }}>🎭</div>
                )}
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontWeight: 600, fontSize: 13, lineHeight: 1.4,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical"
                  }}>{item.title}</div>
                  <div style={{display:"flex", gap:8, marginTop:3, alignItems:"center", flexWrap:"wrap"}}>
                    {item.eventDate && (
                      <span className="small muted">
                        🗓 {new Date(item.eventDate + "T00:00:00").toLocaleDateString("ru-RU", {day:"numeric", month:"long"})}
                      </span>
                    )}
                    {item.venue && <span className="small muted">📍 {item.venue}</span>}
                    {item.price && <span style={{fontSize:11, fontWeight:700, color:"#fbbf24"}}>{item.price}</span>}
                  </div>
                </div>
              </a>
            ))}
            <div style={{marginTop:10, textAlign:"right"}}>
              <a className="btn smallbtn secondary" href="/afisha">Вся афиша →</a>
            </div>
          </div>
        )}

        {activeTab === "places" && (
          <div className="list">
            <div className="list-item">
              <div>
                <b>Кофейня "Город"</b>
                <div className="small muted">Рейтинг: 4.6 • 128 отзывов</div>
              </div>
              <button className="btn smallbtn secondary">Открыть</button>
            </div>
            <div className="list-item">
              <div>
                <b>Фитнес "Pulse"</b>
                <div className="small muted">Рейтинг: 4.3 • 54 отзыва</div>
              </div>
              <button className="btn smallbtn secondary">Открыть</button>
            </div>
            <div className="list-item">
              <div>
                <b>Кинотеатр "Central"</b>
                <div className="small muted">Рейтинг: 4.7 • 302 отзыва</div>
              </div>
              <button className="btn smallbtn secondary">Открыть</button>
            </div>
          </div>
        )}

        {activeTab === "routes" && (
          <div className="list">
            <div className="list-item">
              <div>
                <b>Маршрут: Центр за 2 часа</b>
                <div className="small muted">8 точек • пешком • 2.1 км</div>
              </div>
              <button className="btn smallbtn secondary">Открыть</button>
            </div>
            <div className="list-item">
              <div>
                <b>Маршрут: Кофе + Парк</b>
                <div className="small muted">4 точки • пешком • 1.4 км</div>
              </div>
              <button className="btn smallbtn secondary">Открыть</button>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

function CityPortalHome() {
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/account", { credentials: "same-origin" });
        if (res.ok) {
          const data = await res.json();
          setAccount(data);
        }
      } catch (e) {
      } finally {
        setLoadingAccount(false);
      }
    })();
  }, []);

    async function getCsrfToken() {
      const res = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
      if (!res.ok) throw new Error("CSRF token request failed");
      const data = await res.json();
      return data.token;
    }

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
        console.error("Logout failed", e);
        window.location.href = "/login";
      }
    }

  return (
    <div className="home">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo small" />
          <div>
            <div className="topbar-title">CityPortal</div>
            <div className="topbar-subtitle">Интерактивный портал города</div>
          </div>
        </div>

        <div className="topbar-right">
          {loadingAccount ? (
            <span className="small">Проверяем вход...</span>
          ) : account ? (
            <>
              <span className="small">Вы вошли как: <b>{account.login}</b></span>
              <a className="btn smallbtn secondary" href="/profile">Профиль</a>
              <button className="btn smallbtn secondary" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <a className="btn smallbtn secondary" href="/login">Войти</a>
              <a className="btn smallbtn" href="/register">Регистрация</a>
            </>
          )}
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1 className="hero-title">Добро пожаловать</h1>
          <p className="hero-text">

          </p>

          <div className="hero-actions">
            <a className="btn" href="#widgets">Виджеты</a>
            <a className="btn secondary" href="/map">Карта</a>
            <a className="btn secondary" href="/traffic">Пробки</a>
            <a className="btn secondary" href="/taxi">Такси</a>
          </div>
        </section>

        <section id="widgets" className="section">
          <h2 className="section-title">Виджеты</h2>

          <div className="grid">
            <WeatherWidget />

            <TrafficWidget />

            <TaxiWidget />

            <MapWidget />
          </div>
        </section>

        <CityTabs />

        <footer className="footer" style={{ marginTop: 24 }}>
          <span>© CityPortal</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<CityPortalHome />);