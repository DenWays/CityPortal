const { useEffect, useState, useRef, useCallback } = React;

const DEFAULT_CENTER = [51.7727, 55.1039];
const DEFAULT_ZOOM   = 13;

function MapPage() {
  const [mapReady, setMapReady]       = useState(false);
  const [mapError, setMapError]       = useState(null);
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState([]);
  const [searching, setSearching]     = useState(false);
  const [searchError, setSearchError] = useState(null);
  const mapRef     = useRef(null);
  const markerRef  = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/maps/js-key");
        if (!res.ok) throw new Error("Не удалось получить ключ карты");
        const key = await res.text();

        const script = document.createElement("script");
        script.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
        script.async = true;
        script.onload = () => {
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
    if (!mapReady || mapRef.current) return;
    mapRef.current = new window.ymaps.Map("ymap-container", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      controls: ["zoomControl", "fullscreenControl", "geolocationControl"]
    });
  }, [mapReady]);

  const searchGeocode = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
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
      setResults(mapped.filter(r => r.name.toLowerCase().includes("оренбург")));
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
    debounceRef.current = setTimeout(() => searchGeocode(val), 400);
  };

  const handleSelect = (item) => {
    setQuery(item.name);
    setResults([]);
    if (!mapRef.current) return;

    if (markerRef.current) {
      mapRef.current.geoObjects.remove(markerRef.current);
    }
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

  return (
    <div className="home">

      {/* Топбар */}
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

        {/* Поиск геокодера */}
        <section className="section" style={{ paddingBottom: 0 }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, position: "relative", alignItems: "flex-start" }}>
            <div style={{ position: "relative", flex: "1 1 0", minWidth: 0 }}>
              <input
                type="text"
                className="input"
                placeholder="Введите адрес или место..."
                value={query}
                onChange={handleInput}
                autoComplete="off"
                style={{ width: "100%", boxSizing: "border-box", padding: "14px 16px", fontSize: 15, borderRadius: 14 }}
              />
              {results.length > 0 && (
                <ul style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "var(--bg2, #1e1e2e)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8, margin: 0, padding: 0, listStyle: "none",
                  zIndex: 100, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
                }}>
                  {results.map((r, i) => (
                    <li
                      key={i}
                      onClick={() => handleSelect(r)}
                      style={{
                        padding: "10px 14px", cursor: "pointer",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        fontSize: 14, color: "var(--text, #cdd6f4)"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {r.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="submit" className="btn primary" disabled={searching} style={{ marginTop: 0, padding: "14px 24px", fontSize: 15, borderRadius: 14, whiteSpace: "nowrap", width: "auto", flexShrink: 0 }}>
              {searching ? "..." : "Найти"}
            </button>
          </form>
          {searchError && <div className="msg err" style={{ marginTop: 8 }}>{searchError}</div>}
        </section>

        {/* Контейнер карты */}
        <section className="section">
          {mapError && (
            <div className="msg err">{mapError}</div>
          )}
          {!mapReady && !mapError && (
            <div className="block" style={{ textAlign: "center", padding: 40 }}>
              <span className="muted">Загрузка карты...</span>
            </div>
          )}
          <div
            id="ymap-container"
            style={{
              width: "100%",
              height: "560px",
              borderRadius: 12,
              overflow: "hidden",
              display: mapReady ? "block" : "none",
              border: "1px solid rgba(255,255,255,0.10)"
            }}
          />
        </section>

        <footer className="footer" style={{ marginTop: 24 }}>
          <span>© CityPortal</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MapPage />);