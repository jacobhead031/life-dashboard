type SunTimes = {
  sunrise: string;
  sunset: string;
  dayLength: string;
  sunPct: number;
  isDaytime: boolean;
};

// Point on the upper semicircle. pct=0 → left horizon, pct=1 → right horizon
function arcPoint(pct: number): { x: number; y: number } {
  const alpha = (1 - pct) * Math.PI;
  return { x: 100 + 90 * Math.cos(alpha), y: 100 - 90 * Math.sin(alpha) };
}

// Sunrise sits at 25%, sunset at 75% of the arc
const SR = arcPoint(0.25);
const SS = arcPoint(0.75);

export function SunriseSunsetCard({ times }: { times: SunTimes | null }) {
  // Sun dot position: maps 0→1 (sunrise→sunset) to 25%→75% of arc
  const sunArcPct = times ? 0.25 + times.sunPct * 0.5 : 0;
  const sunPos = arcPoint(sunArcPct);

  return (
    <section className="card span-3 month-card" style={{ animationDelay: ".16s" }}>
      <div className="card-label">sunrise &amp; sunset · toronto</div>

      <div className="arc-wrap">
        <svg viewBox="0 0 200 110" role="img" aria-label="Sun arc for Toronto">
          <defs>
            <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E76F51" stopOpacity={times?.isDaytime ? "0.45" : "0.12"} />
              <stop offset="100%" stopColor="#F4A259" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sun-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F4A259" />
              <stop offset="100%" stopColor="#E76F51" />
            </linearGradient>
          </defs>

          {/* Sky fill */}
          <path d="M10 100 A 90 90 0 0 1 190 100 Z" fill="url(#sky-grad)" />
          {/* Arc path */}
          <path d="M10 100 A 90 90 0 0 1 190 100" fill="none" stroke="var(--line)" strokeWidth="2" />
          {/* Horizon */}
          <line x1="0" y1="100" x2="200" y2="100" stroke="var(--line)" strokeWidth="2" />

          {/* Sunrise marker */}
          <circle cx={SR.x} cy={SR.y} r="3.5" fill="var(--muted-2)" />
          {/* Sunset marker */}
          <circle cx={SS.x} cy={SS.y} r="3.5" fill="var(--muted-2)" />

          {/* Moving sun — only shown during daytime */}
          {times?.isDaytime && (
            <circle cx={sunPos.x} cy={sunPos.y} r="9" fill="url(#sun-grad)" />
          )}

          {/* Night indicator — dim circle on horizon */}
          {times && !times.isDaytime && (
            <circle cx="100" cy="100" r="6" fill="none" stroke="var(--muted-2)" strokeWidth="1.5" strokeDasharray="3 2" />
          )}
        </svg>
      </div>

      <div className="arc-legend">
        <div className="arc-time">
          <span className="arc-label">sunrise</span>
          <span className="arc-val">{times?.sunrise ?? "—"}</span>
        </div>
        <div className="arc-time" style={{ alignItems: "center" }}>
          <span className="arc-label">day length</span>
          <span className="arc-val">{times?.dayLength ?? "—"}</span>
        </div>
        <div className="arc-time" style={{ alignItems: "flex-end" }}>
          <span className="arc-label">sunset</span>
          <span className="arc-val">{times?.sunset ?? "—"}</span>
        </div>
      </div>
    </section>
  );
}
