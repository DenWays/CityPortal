const { useEffect, useState, useRef, useCallback } = React;

const DEFAULT_CENTER = [51.7727, 55.1039];
const DEFAULT_ZOOM   = 13;

const ROUTE_MODES = [
  { key: "pedestrian",  icon: "🚶", label: "Пешком",     color: "#4ade80" },
  { key: "auto",        icon: "🚗", label: "На машине",  color: "#60a5fa" },
  { key: "masstransit", icon: "🚌", label: "Автобусы",   color: "#f472b6" },
];

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}
function formatDistance(meters) {
  if (!meters && meters !== 0) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} км`;
  return `${Math.round(meters)} м`;
}

function RoutePanel({ toPoint, mapRef, onClose, onPickingFromChange, savedAddresses }) {
  const [fromQuery, setFromQuery]       = useState("");
  const [fromCoords, setFromCoords]     = useState(null);
  const [activeMode, setActiveMode]     = useState("pedestrian");
  const [routeInfo, setRouteInfo]       = useState({});
  const [pickingFrom, setPickingFrom]   = useState(false);
  const [suggestions, setSuggestions]   = useState([]);
  const [showSugg, setShowSugg]         = useState(false);

  const [transitRoutes, setTransitRoutes] = useState([]);
  const [activeTransitIdx, setActiveTransitIdx] = useState(0);
  const transitRouteObjsRef = useRef([]);

  const routeObjsRef  = useRef({});
  const fromMarkerRef = useRef(null);
  const debounceRef   = useRef(null);
  const inputWrapRef  = useRef(null);
  const activeModeRef = useRef("pedestrian");

  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);

  useEffect(() => {
    onPickingFromChange && onPickingFromChange(pickingFrom);
  }, [pickingFrom]);

  useEffect(() => {
    return () => {
      Object.values(routeObjsRef.current).forEach(r => {
        try { mapRef.current && mapRef.current.geoObjects.remove(r); } catch (_) {}
      });
      routeObjsRef.current = {};
      transitRouteObjsRef.current.forEach(r => {
        try { mapRef.current && mapRef.current.geoObjects.remove(r); } catch (_) {}
      });
      transitRouteObjsRef.current = [];
      if (fromMarkerRef.current && mapRef.current) {
        try { mapRef.current.geoObjects.remove(fromMarkerRef.current); } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!fromCoords || !toPoint) return;
    setRouteInfo({});
    setTransitRoutes([]);
    setActiveTransitIdx(0);
    ROUTE_MODES.forEach(m => buildSingleRoute(fromCoords, m.key));
  }, [fromCoords]);

  useEffect(() => {
    if (!mapRef.current) return;

    Object.entries(routeObjsRef.current).forEach(([mode, obj]) => {
      if (!obj || mode === "masstransit") return;
      const shouldShow = mode === activeMode;
      try { obj.options.set("visible", shouldShow); } catch (_) {}
    });

    const transitObj = transitRouteObjsRef.current[0];
    if (transitObj) {
      try { transitObj.options.set("visible", activeMode === "masstransit"); } catch (_) {}
    }

    setTimeout(() => {
      try {
        const activeObj = activeMode === "masstransit"
          ? transitRouteObjsRef.current[0]
          : routeObjsRef.current[activeMode];
        if (activeObj && mapRef.current) {
          const bounds = activeObj.getBounds();
          if (bounds) mapRef.current.setBounds(bounds, { checkZoomRange: true, duration: 300, margin: [40, 40, 40, 40] });
        }
      } catch (_) {}
    }, 50);
  }, [activeMode, activeTransitIdx]);

  useEffect(() => {
    if (activeMode !== "masstransit") return;
    const multiRoute = transitRouteObjsRef.current[0];
    if (!multiRoute) return;
    try {
      const allRoutes = multiRoute.getRoutes();
      if (allRoutes && activeTransitIdx < allRoutes.getLength()) {
        multiRoute.setActiveRoute(allRoutes.get(activeTransitIdx));
        const variant = transitRoutes[activeTransitIdx];
        if (variant) {
          setRouteInfo(prev => ({ ...prev, masstransit: { duration: variant.duration, distance: variant.distance, loading: false, steps: variant.steps } }));
        }
      }
    } catch (_) {}
  }, [activeTransitIdx]);

  function extractTransitSteps(route, rawModelRoutes) {
    const icons = { bus: "🚌", trolleybus: "🚎", tram: "🚃", subway: "🚇", suburban: "🚆", minibus: "🚐" };

    function pickRouteName(t) {
      if (!t) return null;
      return t?.line?.name
          || t?.line?.number
          || t?.number
          || t?.name
          || t?.shortName
          || null;
    }

    function pickVehicleType(t) {
      if (!t) return null;
      return (t?.line?.vehicleTypes?.[0] || t?.type || t?.line?.type || "").toLowerCase() || null;
    }

    const steps = [];
    try {
      const path = route.getPaths().get(0);
      const segments = path.getSegments();
      for (let i = 0; i < segments.getLength(); i++) {
        const seg = segments.get(i);
        let raw = {};
        try { raw = seg.properties.getAll() || {}; } catch (_) {}

        if (i < 5) console.log(`[seg ${i}]`, JSON.stringify(raw).slice(0, 300));

        const segType = raw.type
          || raw?.TransportDetails?.type
          || raw?.transport?.type
          || null;

        const isWalk = !segType || segType === "pedestrian" || segType === "walk" || segType === "walking";
        if (isWalk) {
          const dur = raw?.duration?.value ?? (typeof raw?.duration === "number" ? raw.duration : null);
          steps.push({ kind: "walk", dur });
          continue;
        }

        let routeNames = [];
        let vtype = null;

        if (Array.isArray(raw.transports) && raw.transports.length > 0) {
          for (const t of raw.transports) {
            const n = pickRouteName(t);
            if (n && !routeNames.includes(n)) routeNames.push(n);
            if (!vtype) vtype = pickVehicleType(t);
          }
        }

        if (routeNames.length === 0 && raw.transport) {
          const n = pickRouteName(raw.transport);
          if (n) routeNames.push(n);
          if (!vtype) vtype = pickVehicleType(raw.transport);
        }

        if (routeNames.length === 0 && raw.TransportDetails) {
          const td = raw.TransportDetails;
          const n = td?.line?.name || td?.line?.number || td?.name || null;
          if (n) routeNames.push(n);
          if (!vtype) vtype = td?.type || null;
        }

        if (routeNames.length === 0) {
          const n = raw.name || raw.line?.name || raw.line?.number || raw.routeName || null;
          if (n) routeNames.push(n);
        }

        const routeName = routeNames.length > 0 ? routeNames.join(", ") : null;
        const icon = icons[vtype] || "🚌";

        let fromStop = null, toStop = null;
        const stops = raw.stops || raw.Stops || null;
        if (Array.isArray(stops) && stops.length > 0) {
          fromStop = stops[0]?.name || null;
          toStop = stops[stops.length - 1]?.name || null;
        }
        if (!fromStop) fromStop = raw?.beginStop?.name || (typeof raw?.beginStop === "string" ? raw.beginStop : null);
        if (!toStop) toStop = raw?.endStop?.name || (typeof raw?.endStop === "string" ? raw.endStop : null);

        const dur = raw?.duration?.value ?? (typeof raw?.duration === "number" ? raw.duration : null);

        steps.push({ kind: "transit", icon, name: routeName || segType || "?", from: fromStop, to: toStop, dur, type: vtype });
      }
    } catch (e) {
      console.error("[extractTransitSteps seg]", e);
    }

    const hasNames = steps.some(s => s.kind === "transit" && s.name && s.name !== "?" && !/^(bus|tram|trolleybus|suburban|minibus)$/i.test(s.name));
    if (!hasNames && rawModelRoutes) {
      try {
        const fallback = parseStepsFromModelJSON(rawModelRoutes);
        if (fallback.length > 0) {
          console.log("[Transit] fallback from model JSON:", fallback);
          return fallback;
        }
      } catch (_) {}
    }

    console.log("[Transit] steps from segments:", steps);
    return steps;
  }

  function parseStepsFromModelJSON(modelRoutes) {
    const steps = [];
    const icons = { bus: "🚌", trolleybus: "🚎", tram: "🚃", subway: "🚇", suburban: "🚆", minibus: "🚐" };

    const routeArr = Array.isArray(modelRoutes) ? modelRoutes : (modelRoutes ? [modelRoutes] : []);
    const firstRoute = routeArr[0];
    if (!firstRoute) return steps;

    const legs = firstRoute.legs || firstRoute.Legs || [];
    for (const leg of (Array.isArray(legs) ? legs : [])) {
      const legSteps = leg.steps || leg.Steps || [];
      for (const step of (Array.isArray(legSteps) ? legSteps : [])) {
        const stype = (step.type || step.travel_mode || step.travelMode || "").toLowerCase();
        const isWalk = !stype || stype === "walk" || stype === "walking" || stype === "pedestrian";
        if (isWalk) {
          steps.push({ kind: "walk", dur: step.duration?.value ?? step.duration ?? null });
          continue;
        }
        const t = step.transport || step.Transit || {};
        const line = t.line || t.Line || {};
        const name = line.name || line.number || line.shortName || t.name || t.number || step.name || null;
        const vt = (line.vehicleTypes?.[0] || line.type || t.type || "bus").toLowerCase();
        const fromStop = t.stopFrom?.name || step.fromStop?.name || null;
        const toStop = t.stopTo?.name || step.toStop?.name || null;
        steps.push({ kind: "transit", icon: icons[vt] || "🚌", name: name || vt, from: fromStop, to: toStop, dur: step.duration?.value ?? null, type: vt });
      }
    }
    if (steps.length > 0) return steps;

    const sections = firstRoute.sections || firstRoute.Sections || [];
    for (const sec of (Array.isArray(sections) ? sections : [])) {
      const stype = (sec.type || "").toLowerCase();
      if (stype === "walk" || stype === "pedestrian") {
        steps.push({ kind: "walk", dur: sec.duration?.value ?? sec.duration ?? null });
      } else if (stype === "transport" || stype === "transit" || stype === "masstransit") {
        const transports = sec.transports || sec.Transports || [];
        const names = [];
        let vt = null;
        for (const t of (Array.isArray(transports) ? transports : [])) {
          const n = t?.line?.name || t?.line?.number || t?.number || t?.name || null;
          if (n && !names.includes(n)) names.push(n);
          if (!vt) vt = (t?.line?.vehicleTypes?.[0] || t?.type || "").toLowerCase() || null;
        }
        const fromStop = sec.stops?.[0]?.name || null;
        const toStop = sec.stops?.[sec.stops.length - 1]?.name || null;
        steps.push({ kind: "transit", icon: icons[vt] || "🚌", name: names.join(", ") || vt || "?", from: fromStop, to: toStop, dur: sec.duration?.value ?? null, type: vt });
      }
    }
    return steps;
  }

  function buildSingleRoute(coords, mode) {
    if (!window.ymaps || !mapRef.current) return;

    if (mode === "masstransit") {
      transitRouteObjsRef.current.forEach(r => {
        try { mapRef.current && mapRef.current.geoObjects.remove(r); } catch (_) {}
      });
      transitRouteObjsRef.current = [];
      setTransitRoutes([]);
      setActiveTransitIdx(0);
      setRouteInfo(prev => ({ ...prev, masstransit: { loading: true } }));

      const TRANSIT_COLORS = ["#f472b6", "#fb923c", "#a78bfa", "#34d399", "#60a5fa"];
      const NUM_VARIANTS = 5;

      const multiRoute = new window.ymaps.multiRouter.MultiRoute(
        {
          referencePoints: [coords, [toPoint.lat, toPoint.lon]],
          params: { routingMode: "masstransit", results: NUM_VARIANTS }
        },
        {
          boundsAutoApply: false,
          visible: false,
          routeActiveStrokeColor: TRANSIT_COLORS[0],
          routeActiveStrokeWidth: 5,
          routeStrokeWidth: 3,
          routeStrokeStyle: "solid",
          routeOpenBalloonOnClick: false,
          pinVisible: false,
          wayPointVisible: false,
        }
      );

      multiRoute.model.events.once("requestsuccess", () => {
        const allRoutes = multiRoute.getRoutes();
        const count = allRoutes.getLength();
        if (count === 0) {
          setRouteInfo(prev => ({ ...prev, masstransit: { error: "Маршрут не найден", loading: false } }));
          return;
        }

        try {
          const rawModel = multiRoute.model.getRoutes();
          console.log("[masstransit] model.getRoutes():", rawModel);
        } catch (_) {}

        const variants = [];
        for (let ri = 0; ri < count; ri++) {
          const route = allRoutes.get(ri);
          const props = route.properties;
          const duration = props.get("duration")?.value ?? props.get("durationInTraffic")?.value ?? null;
          const distance = props.get("distance")?.value ?? null;

          let rawModelRoutes = null;
          try { rawModelRoutes = multiRoute.model.getRoutes(); } catch (_) {}
          const steps = extractTransitSteps(route, rawModelRoutes ? [rawModelRoutes[ri]] : null);
          const busLines = steps.filter(s => s.kind === "transit");

          variants.push({ idx: ri, duration, distance, steps, busLines, color: TRANSIT_COLORS[ri % TRANSIT_COLORS.length] });
        }

        transitRouteObjsRef.current = [multiRoute];
        try { multiRoute.setActiveRoute(allRoutes.get(0)); } catch (_) {}

        setTransitRoutes(variants);
        setActiveTransitIdx(0);

        const firstDuration = variants[0]?.duration ?? null;
        const firstDistance = variants[0]?.distance ?? null;
        setRouteInfo(prev => ({ ...prev, masstransit: { duration: firstDuration, distance: firstDistance, loading: false, steps: variants[0]?.steps ?? [] } }));

        try { multiRoute.options.set("visible", activeModeRef.current === "masstransit"); } catch (_) {}

        if (activeModeRef.current === "masstransit") {
          try {
            const bounds = multiRoute.getBounds();
            if (bounds) mapRef.current.setBounds(bounds, { checkZoomRange: true, duration: 400, margin: [40, 40, 40, 40] });
          } catch (_) {}
        }
      });

      multiRoute.model.events.once("requesterror", () => {
        setRouteInfo(prev => ({ ...prev, masstransit: { error: "Ошибка", loading: false } }));
      });

      mapRef.current.geoObjects.add(multiRoute);
      routeObjsRef.current["masstransit"] = multiRoute;
      try { multiRoute.options.set("visible", activeModeRef.current === "masstransit"); } catch (_) {}
      return;
    }

    setRouteInfo(prev => ({ ...prev, [mode]: { loading: true } }));
    if (routeObjsRef.current[mode]) {
      try { mapRef.current.geoObjects.remove(routeObjsRef.current[mode]); } catch (_) {}
      routeObjsRef.current[mode] = null;
    }

    const routeColors = { pedestrian: "#4ade80", auto: "#60a5fa" };

    const multiRoute = new window.ymaps.multiRouter.MultiRoute(
      {
        referencePoints: [coords, [toPoint.lat, toPoint.lon]],
        params: { routingMode: mode, results: 1 }
      },
      {
        boundsAutoApply: false,
        visible: false,
        routeActiveStrokeColor: routeColors[mode],
        routeActiveStrokeWidth: 5,
        routeStrokeWidth: 0,
        routeOpenBalloonOnClick: false,
        pinVisible: false,
        wayPointVisible: false,
      }
    );

    multiRoute.model.events.once("requestsuccess", () => {
      const routes = multiRoute.getRoutes();
      if (routes.getLength() === 0) {
        setRouteInfo(prev => ({ ...prev, [mode]: { error: "Маршрут не найден" } }));
        return;
      }
      const route = routes.get(0);
      const props = route.properties;
      const duration = props.get("duration")?.value ?? props.get("durationInTraffic")?.value ?? null;
      const distance = props.get("distance")?.value ?? null;
      setRouteInfo(prev => ({ ...prev, [mode]: { duration, distance, loading: false, steps: [] } }));

      try { multiRoute.options.set("visible", mode === activeModeRef.current); } catch (_) {}

      if (mode === activeModeRef.current) {
        try {
          const bounds = multiRoute.getBounds();
          if (bounds) mapRef.current.setBounds(bounds, { checkZoomRange: true, duration: 400, margin: [40, 40, 40, 40] });
        } catch (_) {}
      }
    });

    multiRoute.model.events.once("requesterror", () => {
      setRouteInfo(prev => ({ ...prev, [mode]: { error: "Ошибка", loading: false } }));
    });

    mapRef.current.geoObjects.add(multiRoute);
    routeObjsRef.current[mode] = multiRoute;
    try { multiRoute.options.set("visible", mode === activeModeRef.current); } catch (_) {}
  }

  function placeFromMarker(lat, lon) {
    if (fromMarkerRef.current && mapRef.current) {
      try { mapRef.current.geoObjects.remove(fromMarkerRef.current); } catch (_) {}
    }
    fromMarkerRef.current = new window.ymaps.Placemark(
      [lat, lon], { hintContent: "Откуда" }, { preset: "islands#greenDotIcon" }
    );
    mapRef.current.geoObjects.add(fromMarkerRef.current);
  }

  function setFrom(lat, lon, label) {
    setFromCoords([lat, lon]);
    setFromQuery(label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    setShowSugg(false);
    placeFromMarker(lat, lon);
  }

  useEffect(() => {
    if (!mapRef.current || !pickingFrom) return;
    const handler = (e) => {
      const [lat, lon] = e.get("coords");
      setPickingFrom(false);
      window.ymaps.geocode([lat, lon], { results: 1 }).then(res => {
        const geoObj = res.geoObjects.get(0);
        let label = null;
        try { label = geoObj?.getAddressLine() || null; } catch (_) {}
        const parts = (label || "").split(",").map(s => s.trim()).filter(Boolean);
        const skipRe = /россия|область|край|округ|республика/i;
        let i = 0;
        while (i < parts.length && skipRe.test(parts[i])) i++;
        label = parts.slice(i).join(", ") || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setFrom(lat, lon, label);
      }).catch(() => setFrom(lat, lon, null));
    };
    mapRef.current.events.add("click", handler);
    return () => {
      try { mapRef.current && mapRef.current.events.remove("click", handler); } catch (_) {}
    };
  }, [pickingFrom]);

  function handleInputChange(e) {
    const val = e.target.value;
    setFromQuery(val);
    setShowSugg(false);
    clearTimeout(debounceRef.current);
    if (!val.trim() || val.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/maps/geocode?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        const members = data?.response?.GeoObjectCollection?.featureMember ?? [];
        const mapped = members.slice(0, 6).map(m => {
          const obj = m.GeoObject;
          const pos = obj.Point.pos.split(" ").map(Number);
          return { name: obj.metaDataProperty?.GeocoderMetaData?.text ?? "", lat: pos[1], lon: pos[0] };
        });
        const filtered = mapped.filter(r => r.name.toLowerCase().includes("оренбург"));
        setSuggestions(filtered);
        setShowSugg(filtered.length > 0);
      } catch (_) { setSuggestions([]); }
    }, 350);
  }

  function handleInputKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); if (suggestions.length > 0) setFrom(suggestions[0].lat, suggestions[0].lon, suggestions[0].name); }
    if (e.key === "Escape") setShowSugg(false);
  }

  useEffect(() => {
    const handler = (e) => {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target)) setShowSugg(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const modeColorRgb = { pedestrian: "74,222,128", auto: "96,165,250", masstransit: "244,114,182" };

  const transitInfo = routeInfo["masstransit"];
  const activeTransitVariant = transitRoutes[activeTransitIdx] ?? null;
  const transitSteps = activeTransitVariant?.steps ?? transitInfo?.steps ?? [];
  const busLines = transitSteps.filter(s => s.kind === "transit");

  return (
    <div style={{
      background: "rgba(15,17,30,0.97)",
      border: "1px solid rgba(255,255,255,0.13)",
      borderRadius: 16,
      padding: "18px 20px",
      marginTop: 12,
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      backdropFilter: "blur(12px)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5 }}>КАК ДОБРАТЬСЯ</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>🏁 {toPoint.name || toPoint.address}</div>
          {toPoint.name && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{toPoint.address}</div>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 18, padding: 0, lineHeight: 1, marginLeft: 12 }}>✕</button>
      </div>

      {/* From input */}
      <div style={{ marginBottom: 14 }} ref={inputWrapRef}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>📍 Откуда:</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              className="input"
              value={fromQuery}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onFocus={() => {
                const favM = (fromQuery.length >= 2 && (savedAddresses || []).length > 0)
                  ? (savedAddresses || []).filter(a =>
                      a.label.toLowerCase().includes(fromQuery.toLowerCase()) ||
                      a.address.toLowerCase().includes(fromQuery.toLowerCase()))
                  : [];
                if (suggestions.length > 0 || favM.length > 0) setShowSugg(true);
              }}
              placeholder="Введите адрес..."
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 13, borderRadius: 10 }}
            />
            {showSugg && (() => {
              const favMatches = (fromQuery.length >= 2 && (savedAddresses || []).length > 0)
                ? (savedAddresses || []).filter(a =>
                    a.label.toLowerCase().includes(fromQuery.toLowerCase()) ||
                    a.address.toLowerCase().includes(fromQuery.toLowerCase()))
                : [];
              const hasItems = favMatches.length > 0 || suggestions.length > 0;
              if (!hasItems) return null;
              return (
                <ul style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "var(--bg2, rgba(20,22,40,0.99))", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8, margin: "4px 0 0", padding: 0, listStyle: "none",
                  zIndex: 600, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
                }}>
                  {favMatches.length > 0 && (
                    <>
                      <li style={{ padding: "6px 12px 4px", fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5, borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "default" }}>
                        ⭐ ИЗБРАННЫЕ АДРЕСА
                      </li>
                      {favMatches.map((fav, i) => (
                        <li key={"fav-" + i} onMouseDown={() => setFrom(fav.lat, fav.lon, fav.address)}
                          style={{ padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13 }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(251,191,36,0.10)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><span>⭐</span>{fav.label}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{fav.address}</div>
                        </li>
                      ))}
                    </>
                  )}
                  {suggestions.map((s, i) => (
                    <li key={i} onMouseDown={() => setFrom(s.lat, s.lon, s.name)}
                      style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      {s.name}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
          <button type="button" className="btn smallbtn"
            style={{
              marginTop: 0, padding: "9px 14px", flexShrink: 0,
              background: pickingFrom ? "rgba(74,222,128,0.25)" : "rgba(74,222,128,0.10)",
              borderColor: pickingFrom ? "#4ade80" : "rgba(74,222,128,0.4)",
              color: pickingFrom ? "#4ade80" : "rgba(74,222,128,0.85)",
              fontWeight: 700, fontSize: 13,
              boxShadow: pickingFrom ? "0 0 0 2px rgba(74,222,128,0.3)" : "none",
              transition: "all 0.15s"
            }}
            onClick={() => setPickingFrom(p => !p)} title="Выбрать точку на карте">
            {pickingFrom ? "✕ Отмена" : "📍 На карте"}
          </button>
        </div>
        {pickingFrom && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 6 }}>
            <span>●</span> Кликните на карте, чтобы выбрать точку отправления
          </div>
        )}
      </div>

      {/* Placeholder */}
      {!fromCoords && (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "10px 0" }}>
          Укажите точку отправления — маршруты посчитаются автоматически
        </div>
      )}

      {/* Route mode cards */}
      {fromCoords && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {ROUTE_MODES.map(m => {
            const info = routeInfo[m.key];
            const isActive = activeMode === m.key;
            const rgb = modeColorRgb[m.key];
            return (
              <div key={m.key} onClick={() => setActiveMode(m.key)}
                style={{
                  flex: "1 1 120px",
                  background: isActive ? `rgba(${rgb},0.10)` : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${isActive ? m.color : "rgba(255,255,255,0.09)"}`,
                  borderRadius: 12, padding: "12px 14px", cursor: "pointer",
                  transition: "all 0.15s", userSelect: "none",
                }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? m.color : "rgba(255,255,255,0.6)" }}>{m.label}</div>
                {(!info || info.loading) && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>⏳ считаю…</div>
                )}
                {info && !info.loading && info.error && (
                  <div style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>{info.error}</div>
                )}
                {info && !info.loading && !info.error && (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 800, color: m.color, marginTop: 6, lineHeight: 1 }}>
                      {formatDuration(info.duration)}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
                      {formatDistance(info.distance)}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transit — multiple route variants */}
      {fromCoords && activeMode === "masstransit" && transitInfo && !transitInfo.loading && !transitInfo.error && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 10 }}>
            ВАРИАНТЫ МАРШРУТОВ НА АВТОБУСЕ
          </div>

          {/* Variant tabs */}
          {transitRoutes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {transitRoutes.map((variant, vi) => {
                const isActive = vi === activeTransitIdx;
                const variantBuses = variant.busLines || [];
                const transfers = Math.max(0, variantBuses.length - 1);
                return (
                  <div key={vi} onClick={() => setActiveTransitIdx(vi)}
                    style={{
                      background: isActive ? "rgba(244,114,182,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1.5px solid ${isActive ? "#f472b6" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 12, padding: "10px 14px", cursor: "pointer",
                      transition: "all 0.15s", userSelect: "none",
                    }}>
                    {/* Top row: duration + distance */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f472b6", flexShrink: 0 }} />}
                        <span style={{ fontSize: 16, fontWeight: 800, color: isActive ? "#f9a8d4" : "rgba(255,255,255,0.75)" }}>
                          {formatDuration(variant.duration)}
                        </span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                          {formatDistance(variant.distance)}
                        </span>
                        {transfers > 0 && (
                          <span style={{
                            fontSize: 11, color: "rgba(255,200,100,0.85)",
                            background: "rgba(255,200,100,0.12)",
                            border: "1px solid rgba(255,200,100,0.25)",
                            borderRadius: 6, padding: "1px 7px"
                          }}>
                            {transfers} пересадк{transfers === 1 ? "а" : transfers < 5 ? "и" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Bus number chips */}
                    {variantBuses.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {variantBuses.map((b, bi) => (
                          <span key={bi} style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            background: isActive ? "rgba(244,114,182,0.18)" : "rgba(255,255,255,0.07)",
                            border: `1px solid ${isActive ? "rgba(244,114,182,0.4)" : "rgba(255,255,255,0.12)"}`,
                            borderRadius: 6, padding: "3px 9px",
                            fontSize: 13, fontWeight: 800,
                            color: isActive ? "#f9a8d4" : "rgba(255,255,255,0.65)",
                          }}>
                            {b.icon} {b.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Детали маршрута недоступны</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step-by-step for selected variant */}
          {transitSteps.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>
                ПОДРОБНЫЙ МАРШРУТ
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {transitSteps.map((step, i) => (
                  <div key={i}>
                    {step.kind === "walk" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 4px" }}>
                        <span style={{ fontSize: 15 }}>🚶</span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                          Пешком {step.dur ? formatDuration(step.dur) : ""}
                        </span>
                      </div>
                    ) : (
                      <div style={{
                        background: "rgba(244,114,182,0.07)",
                        border: "1px solid rgba(244,114,182,0.22)",
                        borderRadius: 10, padding: "9px 12px",
                        display: "flex", alignItems: "flex-start", gap: 10,
                      }}>
                        <div style={{
                          background: "rgba(244,114,182,0.2)", borderRadius: 7,
                          padding: "4px 9px", fontWeight: 900,
                          color: "#f9a8d4", flexShrink: 0, minWidth: 40, textAlign: "center",
                          lineHeight: 1.3
                        }}>
                          <div style={{ fontSize: 15 }}>{step.icon}</div>
                          <div style={{ fontSize: 13, marginTop: 1 }}>{step.name}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          {step.from && (
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                              <span style={{ color: "rgba(255,255,255,0.35)" }}>от </span>{step.from}
                              {step.to && <><span style={{ color: "rgba(255,255,255,0.35)" }}> → </span>{step.to}</>}
                            </div>
                          )}
                          {step.dur && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                              ⏱ {formatDuration(step.dur)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {i < transitSteps.length - 1 && (
                      <div style={{ paddingLeft: 14, color: "rgba(255,255,255,0.15)", fontSize: 11 }}>│</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {transitRoutes.length === 0 && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Детали маршрута недоступны</div>
          )}
        </div>
      )}
    </div>
  );
}

function SavedMessage({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ fontSize: 13, color: "#4ade80", marginTop: 6 }}>✓ Добавлено в избранное!</div>
  );
}

function PointPopup({ point, onClose, onSaved, onRoute, isLoggedIn }) {
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
            onClick={() => onRoute && onRoute(point)}
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
  const [clickedPoint, setClickedPoint]     = useState(null);
  const [isLoggedIn, setIsLoggedIn]         = useState(false);

  const [routeTarget, setRouteTarget] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("route") === "1") {
        const lat = parseFloat(p.get("toLat"));
        const lon = parseFloat(p.get("toLon"));
        const address = p.get("toAddress") || "";
        if (!isNaN(lat) && !isNaN(lon)) return { lat, lon, address };
      }
    } catch (_) {}
    return null;
  });

  const mapRef        = useRef(null);
  const markerRef     = useRef(null);
  const clickMarkerRef = useRef(null);
  const favMarkersRef = useRef([]);
  const debounceRef   = useRef(null);
  const inputWrapRef  = useRef(null);
  const pickingFromRef = useRef(false);

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
      if (pickingFromRef.current) return;
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

  }, [mapReady]);

  useEffect(() => {
    if (mapReady && mapRef.current) {
      placeFavouriteMarkers(mapRef.current, savedAddresses);
    }
  }, [mapReady, savedAddresses, placeFavouriteMarkers]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !routeTarget) return;
    const { lat, lon, address } = routeTarget;
    mapRef.current.setCenter([lat, lon], 15, { duration: 500 });
    if (clickMarkerRef.current) mapRef.current.geoObjects.remove(clickMarkerRef.current);
    clickMarkerRef.current = new window.ymaps.Placemark(
      [lat, lon], { hintContent: address }, { preset: "islands#blueDotIcon" }
    );
    mapRef.current.geoObjects.add(clickMarkerRef.current);
  }, [mapReady]);

  function handlePopupClose() {
    setClickedPoint(null);
    if (clickMarkerRef.current && mapRef.current) {
      try { mapRef.current.geoObjects.remove(clickMarkerRef.current); } catch (_) {}
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
            <PointPopup
              point={clickedPoint}
              onClose={handlePopupClose}
              onSaved={handlePopupSaved}
              onRoute={(point) => setRouteTarget(point)}
              isLoggedIn={isLoggedIn}
            />
          </div>

          {/* Route panel — shown below the map */}
          {routeTarget && mapReady && (
            <RoutePanel
              toPoint={routeTarget}
              mapRef={mapRef}
              onClose={() => setRouteTarget(null)}
              onPickingFromChange={(picking) => { pickingFromRef.current = picking; }}
              savedAddresses={savedAddresses}
            />
          )}
        </section>

        <footer className="footer" style={{ marginTop: 24 }}>
          <span>© CityPortal</span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MapPage />);