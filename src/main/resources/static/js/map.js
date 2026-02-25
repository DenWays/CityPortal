const { useEffect, useState, useRef } = React;

const DEFAULT_CENTER = [51.7727, 55.1039];
const DEFAULT_ZOOM   = 13;

function MapPage() {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);

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
      controls: ["zoomControl", "searchControl", "fullscreenControl", "geolocationControl"]
    });
  }, [mapReady]);

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
              height: "600px",
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