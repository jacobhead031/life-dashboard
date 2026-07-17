import Link from "next/link";
import type { HealthDay } from "@/lib/types";

function recoveryColor(pct: number) {
  if (pct >= 67) return "var(--green)";
  if (pct >= 34) return "var(--amber)";
  return "var(--coral)";
}

export function HealthCard({
  latest,
  lastWeight,
}: {
  latest: HealthDay | null;
  lastWeight: { date: string; weight: number } | null;
}) {
  return (
    <section className="card span-6" style={{ animationDelay: ".04s" }}>
      <div className="card-label">
        <span>health</span>
        <Link href="/health" className="card-nav">view →</Link>
      </div>
      {latest ? (
        <div className="health-strip">
          {latest.recovery_pct !== null && (
            <div className="hs-item">
              <span className="hs-val" style={{ color: recoveryColor(latest.recovery_pct) }}>
                {Math.round(latest.recovery_pct)}%
              </span>
              <span className="hs-label">recovery</span>
            </div>
          )}
          {latest.sleep_hours !== null && (
            <div className="hs-item">
              <span className="hs-val">{latest.sleep_hours.toFixed(1)}h</span>
              <span className="hs-label">sleep</span>
            </div>
          )}
          {latest.strain !== null && (
            <div className="hs-item">
              <span className="hs-val">{latest.strain.toFixed(1)}</span>
              <span className="hs-label">strain</span>
            </div>
          )}
          {latest.calories !== null && (
            <div className="hs-item">
              <span className="hs-val">{Math.round(latest.calories)}</span>
              <span className="hs-label">kcal logged</span>
            </div>
          )}
          {lastWeight && (
            <div className="hs-item">
              <span className="hs-val">{lastWeight.weight}</span>
              <span className="hs-label">weight</span>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <p>No health data yet — the nightly sync fills this in.</p>
        </div>
      )}
    </section>
  );
}
