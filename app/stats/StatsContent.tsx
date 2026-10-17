"use client";

import type { HealthDay, TriActivity } from "@/lib/types";
import { addDays, weekMonday } from "@/lib/utils";
import { Bars, Sparkline } from "@/app/health/HealthContent";

type Week = { monday: string; minutes: number; load: number; swim_m: number; bike_km: number; run_km: number; count: number };

function fmtDay(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function hm(min: number) {
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;
}
function pace(sPerKm: number) {
  return `${Math.floor(sPerKm / 60)}:${String(Math.round(sPerKm % 60)).padStart(2, "0")} /km`;
}
function avg(vals: (number | null)[]) {
  const v = vals.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function latest<T>(rows: HealthDay[], key: keyof HealthDay): T | null {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] != null) return rows[i][key] as T;
  return null;
}

export function StatsContent({ today, health, activities, profile }: {
  today: string; health: HealthDay[]; activities: TriActivity[];
  profile: { ftp_watts: number | null; css_s_100m: number | null; thr_run_s_km: number | null; weight_kg: number | null } | null;
}) {
  const thisMonday = weekMonday(today);
  const weeks: Week[] = Array.from({ length: 12 }, (_, i) => ({
    monday: addDays(thisMonday, -7 * (11 - i)), minutes: 0, load: 0, swim_m: 0, bike_km: 0, run_km: 0, count: 0,
  }));
  for (const a of activities) {
    const w = weeks.find((x) => x.monday === weekMonday(a.date));
    if (!w) continue;
    w.minutes += (a.duration_s ?? 0) / 60;
    w.load += a.load ?? 0;
    w.count += 1;
    if (a.sport === "swim") w.swim_m += a.distance_m ?? 0;
    if (a.sport === "bike") w.bike_km += (a.distance_m ?? 0) / 1000;
    if (a.sport === "run") w.run_km += (a.distance_m ?? 0) / 1000;
  }
  const thisWeek = weeks[11];
  const last7 = health.filter((h) => h.date > addDays(today, -7));
  const vo2 = latest<number>(health, "vo2max");
  const weight = latest<number>(health, "weight");
  const ctl = latest<number>(health, "ctl");
  const eftp = [...activities].reverse().map((a) => (a.raw as { icu_pm_ftp?: number } | null)?.icu_pm_ftp).find((v) => v != null) ?? null;
  const longest = (sport: string) => activities.filter((a) => a.sport === sport).sort((a, b) => (b.distance_m ?? 0) - (a.distance_m ?? 0))[0];
  const runs = activities.filter((a) => a.sport === "run" && a.pace_s_km && (a.distance_m ?? 0) >= 3000);
  const fastestRun = runs.sort((a, b) => (a.pace_s_km ?? 1e9) - (b.pace_s_km ?? 1e9))[0];
  const series = (key: keyof HealthDay) => health.filter((h) => h[key] != null).map((h) => ({ date: h.date, value: h[key] as number }));

  return (
    <div className="grid-bento">
      <section className="card span-6">
        <div className="card-label"><span>headline numbers</span></div>
        <div className="health-strip">
          <div className="hs-item"><span className="hs-val">{vo2 != null ? vo2.toFixed(0) : "—"}</span><span className="hs-label">VO2 max</span></div>
          <div className="hs-item"><span className="hs-val">{eftp ?? profile?.ftp_watts ?? "—"}</span><span className="hs-label">{eftp ? "eFTP (W)" : "FTP (W)"}</span></div>
          <div className="hs-item"><span className="hs-val">{avg(last7.map((h) => h.rhr))?.toFixed(0) ?? "—"}</span><span className="hs-label">resting HR · 7d</span></div>
          <div className="hs-item"><span className="hs-val">{avg(last7.map((h) => h.hrv))?.toFixed(0) ?? "—"}</span><span className="hs-label">HRV · 7d</span></div>
          <div className="hs-item"><span className="hs-val">{weight != null ? weight : "—"}</span><span className="hs-label">weight</span></div>
          <div className="hs-item"><span className="hs-val">{ctl != null ? ctl.toFixed(0) : "—"}</span><span className="hs-label">fitness (CTL)</span></div>
          <div className="hs-item"><span className="hs-val">{hm(thisWeek.minutes)}</span><span className="hs-label">this week</span></div>
          <div className="hs-item"><span className="hs-val">{thisWeek.run_km.toFixed(1)}</span><span className="hs-label">km run · week</span></div>
          <div className="hs-item"><span className="hs-val">{thisWeek.bike_km.toFixed(0)}</span><span className="hs-label">km bike · week</span></div>
          <div className="hs-item"><span className="hs-val">{(thisWeek.swim_m / 1000).toFixed(1)}</span><span className="hs-label">km swim · week</span></div>
        </div>
        {activities.length === 0 && (
          <p className="coach-meta" style={{ marginTop: 10 }}>
            No workouts here yet. In Intervals.icu click &ldquo;Import all Garmin data&rdquo; on the Garmin card, and tick &ldquo;Download wellness data&rdquo; with only VO2 Max and Steps selected, so WHOOP keeps sleep and HRV. Then history fills in on the next sync.
          </p>
        )}
      </section>

      <section className="card span-3">
        <div className="card-label"><span>exercise time · 12 weeks</span></div>
        <Bars points={weeks.map((w) => ({ date: w.monday, value: w.minutes ? Math.round(w.minutes) : null }))} color="var(--sky)" format={(v) => `${hm(v)} h`} />
      </section>
      <section className="card span-3">
        <div className="card-label"><span>training load · 12 weeks</span></div>
        <Bars points={weeks.map((w) => ({ date: w.monday, value: w.load ? Math.round(w.load) : null }))} color="var(--amber)" format={(v) => `${v} TSS`} />
      </section>

      <section className="card span-6">
        <div className="card-label"><span>weekly mileage</span></div>
        <table className="coach-gear stats-table">
          <thead><tr><th>week</th><th>sessions</th><th>time</th><th>swim</th><th>bike</th><th>run</th><th>load</th></tr></thead>
          <tbody>
            {[...weeks].reverse().map((w) => (
              <tr key={w.monday} className={w.count ? "" : "have"}>
                <td>{fmtDay(w.monday)}{w.monday === thisMonday ? " · now" : ""}</td>
                <td>{w.count || "—"}</td>
                <td>{w.minutes ? hm(w.minutes) : "—"}</td>
                <td>{w.swim_m ? `${(w.swim_m / 1000).toFixed(1)} km` : "—"}</td>
                <td>{w.bike_km ? `${w.bike_km.toFixed(0)} km` : "—"}</td>
                <td>{w.run_km ? `${w.run_km.toFixed(1)} km` : "—"}</td>
                <td>{w.load ? Math.round(w.load) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card span-3">
        <div className="card-label"><span>bests · 12 weeks</span></div>
        <ul className="rec-list" style={{ fontSize: 13 }}>
          {(["run", "bike", "swim"] as const).map((sp) => {
            const a = longest(sp);
            return <li key={sp}>Longest {sp}: {a ? `${sp === "swim" ? `${a.distance_m} m` : `${((a.distance_m ?? 0) / 1000).toFixed(1)} km`} · ${fmtDay(a.date)}` : "—"}</li>;
          })}
          <li>Fastest run (3 km+): {fastestRun?.pace_s_km ? `${pace(fastestRun.pace_s_km)} · ${fmtDay(fastestRun.date)}` : "—"}</li>
          <li>Zones: FTP {profile?.ftp_watts ?? "—"} W · CSS {profile?.css_s_100m ? `${Math.floor(profile.css_s_100m / 60)}:${String(profile.css_s_100m % 60).padStart(2, "0")}/100m` : "—"} · run threshold {profile?.thr_run_s_km ? pace(profile.thr_run_s_km) : "—"}</li>
        </ul>
      </section>

      <section className="card span-3">
        <div className="card-label"><span>VO2 max · 90 days</span></div>
        {series("vo2max").length >= 2 ? <Sparkline points={series("vo2max")} color="var(--green)" format={(v) => v.toFixed(1)} /> : <div className="empty-state"><p>Needs Garmin wellness (VO2 Max) switched on in Intervals.icu.</p></div>}
      </section>
      <section className="card span-2">
        <div className="card-label"><span>resting HR · 90 days</span></div>
        <Sparkline points={series("rhr")} color="var(--coral)" format={(v) => `${v.toFixed(0)} bpm`} />
      </section>
      <section className="card span-2">
        <div className="card-label"><span>HRV · 90 days</span></div>
        <Sparkline points={series("hrv")} color="var(--sky)" format={(v) => `${v.toFixed(0)} ms`} />
      </section>
      <section className="card span-2">
        <div className="card-label"><span>weight · 90 days</span></div>
        <Sparkline points={series("weight")} color="var(--amber)" format={(v) => `${v}`} />
      </section>
    </div>
  );
}
