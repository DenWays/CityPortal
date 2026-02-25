const { useEffect, useState, useRef, useCallback } = React;

// Центр Оренбурга
const DEFAULT_CENTER = [51.7727, 55.1039];
const DEFAULT_ZOOM   = 13;

function MapPage() {
  const [mapReady, setMapReady]         = useState(false);
  const [mapError, setMapError]         = useState(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [searching, setSearching]       = useState(false);
  const [searchError, setSearchError]   = useState(null);
  const [searchResult, setSearchResult] = useState(null);

  const mapRef       = useRef(null);  // ymaps.Map instance
  const placemarkRef = useRef(null);  // текущая метка

  // Загружаем JS API Яндекс Карт динамически
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

  // Инициализируем карту после готовности API
  useEffect(() => {
    if (!mapReady) return;
    if (mapRef.current) return;

    mapRef.current = new window.ymaps.Map("ymap-container", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      controls: ["zoomControl", "searchControl", "fullscreenControl", "geolocationControl"]
    });
  }, [mapReady]);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(searchQuery)}`);
      if (res.status === 404) throw new Error("Место не найдено");
      if (!res.ok) throw new Error("Ошибка геокодирования");

      const coords = await res.text(); // "lat,lon"
      const [lat, lon] = coords.split(",").map(Number);

      if (placemarkRef.current) {
        mapRef.current.geoObjects.remove(placemarkRef.current);
      }

      const placemark = new window.ymaps.Placemark(
        [lat, lon],
        { balloonContent: searchQuery, hintContent: searchQuery },
        { preset: "islands#redDotIcon" }
      );

      mapRef.current.geoObjects.add(placemark);
      mapRef.current.setCenter([lat, lon], 15, { duration: 500 });
      placemark.balloon.open();
      placemarkRef.current = placemark;

      setSearchResult(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

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

        {/* Поиск */}
        <section className="section" style={{ paddingBottom: 0 }}>
          <h2 className="section-title">Поиск на карте</h2>
          <div className="block" style={{ padding: "14px 16px" }}>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                type="text"
                placeholder="Введите адрес или место..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn"
                type="submit"
                disabled={searching}
                style={{ width: "auto", marginTop: 0, minWidth: 90 }}
              >
                {searching ? "Поиск..." : "🔍 Найти"}
              </button>
            </form>

            {searchError && (
              <div className="msg err" style={{ marginTop: 8 }}>{searchError}</div>
            )}
            {searchResult && (
              <div className="small muted" style={{ marginTop: 8 }}>
                📍 Координаты: {searchResult}
              </div>
            )}
          </div>
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

