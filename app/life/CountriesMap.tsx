"use client";

// The visited-countries map: list on the left, globe (or flat map) on the right.
// Loaded on demand from LifeContent because the country shapes are ~750 KB.
import { useEffect, useMemo, useRef, useState } from "react";
import { geoContains, geoEqualEarth, geoGraticule10, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topo from "world-atlas/countries-50m.json";
import type { LifeCounterEntry } from "@/lib/types";
import { countryKey, distinctCountries, niceCountry } from "@/lib/countries";

const world = topo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const COUNTRIES = feature(world, world.objects.countries).features.map((f) => {
  const name = niceCountry(f.properties.name);
  return { shape: f, name, key: countryKey(name) };
});
const NAMES = COUNTRIES.map((c) => c.name).sort((a, b) => a.localeCompare(b));
const ON_MAP = new Set(COUNTRIES.map((c) => c.key));
const SPHERE = { type: "Sphere" } as const;
const GRATICULE = geoGraticule10();

// Canvas can't read CSS variables cheaply per frame; these mirror the .life palette.
const INK = "#0F0C0A", SEA = "#16110E", SEAM = "#3A2C22", LAND = "#4A4038", OCHRE = "#D9A441", BONE = "#EFE6D6";

export default function CountriesMap({
  entries,
  target,
  busy,
  add,
  openAlbum,
  renderEntry,
  close,
}: {
  entries: LifeCounterEntry[]; // the "countries" counter's entries; repeat trips allowed
  target: number;
  busy: boolean;
  add: (name: string, date: string | null) => void;
  openAlbum: (entryId: string) => void;
  renderEntry: (e: LifeCounterEntry) => React.ReactNode;
  close: () => void;
}) {
  const [flat, setFlat] = useState(false);
  const [selected, setSelected] = useState<string | null>(null); // country key
  const [hover, setHover] = useState<string | null>(null); // country name under the mouse
  const canvas = useRef<HTMLCanvasElement>(null);
  // Mutable view state: changes every frame while dragging, so it stays out of React state.
  const view = useRef({ lon: 80, lat: -35, spinning: true, projection: null as GeoProjection | null, draw: () => {}, queued: false });
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);

  const visited = useMemo(() => new Set(entries.map((e) => countryKey(e.name))), [entries]);
  const offMap = entries.filter((e) => !ON_MAP.has(countryKey(e.name)));
  const picked = COUNTRIES.find((c) => c.key === selected);
  const pickedTrips = picked ? entries.filter((e) => countryKey(e.name) === picked.key) : [];

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const v = view.current;

    v.draw = () => {
      v.queued = false;
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pad = Math.min(w, h) * 0.05;
      const projection = (flat ? geoEqualEarth() : geoOrthographic().rotate([v.lon, v.lat])).fitExtent([[pad, pad], [w - pad, h - pad]], SPHERE);
      v.projection = projection;
      const path = geoPath(projection, ctx);

      ctx.beginPath(); path(SPHERE);
      ctx.fillStyle = SEA; ctx.fill();
      ctx.strokeStyle = SEAM; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); path(GRATICULE);
      ctx.strokeStyle = "rgba(239,230,214,.05)"; ctx.lineWidth = 0.5; ctx.stroke();

      // Not been: grey. One path for all of them keeps a frame cheap.
      ctx.beginPath();
      for (const c of COUNTRIES) if (!visited.has(c.key)) path(c.shape);
      ctx.fillStyle = LAND; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();

      // Been: lit up.
      ctx.save();
      ctx.beginPath();
      for (const c of COUNTRIES) if (visited.has(c.key)) path(c.shape);
      ctx.shadowColor = OCHRE; ctx.shadowBlur = 16;
      ctx.fillStyle = OCHRE; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke();

      const sel = COUNTRIES.find((c) => c.key === selected);
      if (sel) {
        ctx.beginPath(); path(sel.shape);
        ctx.strokeStyle = BONE; ctx.lineWidth = 1.5; ctx.stroke();
      }
    };

    const resize = new ResizeObserver(() => v.draw());
    resize.observe(el);
    // A slow idle spin until the globe is first touched.
    const still = flat || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = () => {
      if (v.spinning && !still) { v.lon += 0.06; v.draw(); }
      raf = requestAnimationFrame(tick);
    };
    v.draw();
    raf = requestAnimationFrame(tick);
    return () => { resize.disconnect(); cancelAnimationFrame(raf); };
  }, [flat, visited, selected]);

  function redraw() {
    const v = view.current;
    if (v.queued) return;
    v.queued = true;
    requestAnimationFrame(v.draw);
  }

  function countryAt(x: number, y: number) {
    const el = canvas.current, projection = view.current.projection;
    if (!el || !projection?.invert) return undefined;
    // The globe's invert() also answers for points off the disc; rule those out first.
    if (!flat && Math.hypot(x - el.clientWidth / 2, y - el.clientHeight / 2) > projection.scale()) return undefined;
    const point = projection.invert([x, y]);
    if (!point || Number.isNaN(point[0]) || Number.isNaN(point[1])) return undefined;
    return COUNTRIES.find((c) => geoContains(c.shape, point));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    view.current.spinning = false;
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current, v = view.current;
    if (!d) {
      if (e.pointerType === "mouse") setHover(countryAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY)?.name ?? null);
      return;
    }
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
    if (flat) return;
    // Degrees per pixel so the surface roughly follows the finger.
    const k = 180 / (Math.PI * (v.projection?.scale() ?? 250));
    v.lon += dx * k;
    v.lat = Math.max(-85, Math.min(85, v.lat - dy * k));
    redraw();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    drag.current = null;
    // A press that barely moved is a click on a country, not a spin.
    if (d && d.moved < 6) setSelected(countryAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY)?.key ?? null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    const step = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (!step || flat) return;
    e.preventDefault();
    const v = view.current;
    v.spinning = false;
    v.lon -= step[0];
    v.lat = Math.max(-85, Math.min(85, v.lat + step[1]));
    redraw();
  }

  return (
    <div className="cm">
      <aside className="cm-side">
        <div className="life-kicker">countries</div>
        <div className="life-counter-num">{distinctCountries(entries.map((e) => e.name))}<small>/{target}</small></div>

        <form
          className="cm-add"
          onSubmit={(ev) => {
            ev.preventDefault();
            const form = ev.currentTarget;
            const f = new FormData(form);
            const name = String(f.get("name") ?? "").trim();
            if (!name) return;
            add(name, String(f.get("date") ?? "") || null);
            setSelected(countryKey(name));
            form.reset();
          }}
        >
          <input className="quick-add-input" name="name" list="cm-names" placeholder="Add a country…" aria-label="Country" maxLength={200} required autoComplete="off" />
          <datalist id="cm-names">{NAMES.map((n) => <option key={n} value={n} />)}</datalist>
          <input className="quick-add-input" name="date" type="date" aria-label="Date of the trip" />
          <button type="submit" className="d-btn" disabled={busy}>add</button>
        </form>

        {entries.length === 0 && <p className="life-none" style={{ marginTop: 12 }}>Nowhere yet. Add a country here, or click one on the map.</p>}
        {entries.map(renderEntry)}
        {offMap.length > 0 && (
          <p className="ty-sub" style={{ marginTop: 12 }}>
            Not lit on the map: {offMap.map((e) => e.name).join(", ")}. Pick the name from the suggestions when adding and it will glow.
          </p>
        )}
      </aside>

      <div className="cm-map">
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label={`World map. ${visited.size} countries visited are highlighted. Arrow keys turn the globe; the list beside it has every country.`}
          style={{ cursor: hover ? "pointer" : flat ? "default" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { drag.current = null; }}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKeyDown}
        />
        <div className="cm-tools">
          <div className="d-tabs">
            <button type="button" className={`d-tab${flat ? "" : " active"}`} aria-pressed={!flat} onClick={() => setFlat(false)}>globe</button>
            <button type="button" className={`d-tab${flat ? " active" : ""}`} aria-pressed={flat} onClick={() => setFlat(true)}>flat</button>
          </div>
          <button type="button" className="gd-close" style={{ position: "static" }} aria-label="Close map" onClick={close}>✕</button>
        </div>
        {hover && <div className="cm-hover">{hover}</div>}

        {picked && (
          <div className="cm-bar">
            <span className="cm-bar-name">{picked.name}</span>
            {pickedTrips.length > 0 ? (
              pickedTrips.map((t) => (
                <button key={t.id} type="button" className="btn primary" onClick={() => openAlbum(t.id)}>
                  open album{pickedTrips.length > 1 && t.happened_on ? ` · ${t.happened_on.slice(0, 4)}` : ""}
                </button>
              ))
            ) : (
              <button type="button" className="btn primary" disabled={busy} onClick={() => add(picked.name, null)}>I&apos;ve been here</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
