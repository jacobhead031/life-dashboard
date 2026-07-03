import Link from "next/link";
import type { Target } from "@/lib/types";

export function TargetsCard({
  targets,
  currentYear,
}: {
  targets: Target[];
  currentYear: number;
}) {
  return (
    <section className="card span-3" style={{ animationDelay: ".14s" }}>
      <div className="card-label">
        <span>yearly targets · {currentYear}</span>
        <Link href="/targets" className="card-nav">view →</Link>
      </div>

      {targets.length === 0 ? (
        <div className="empty-state">
          <p>No targets set yet. Add something to count or beat.</p>
          <Link href="/targets" className="empty-link">
            → add a target
          </Link>
        </div>
      ) : (
        targets.map((target) => {
          const progress =
            target.goal > 0
              ? Math.min(target.current / target.goal, 1)
              : 0;
          const u = target.unit ? ` ${target.unit}` : "";

          const valLabel =
            target.kind === "count"
              ? `${target.current}${u} / ${target.goal}${u}`
              : `best: ${target.current}${u}`;

          return (
            <div key={target.id} className="trow">
              <div className="t-top">
                <span className="t-name">{target.name}</span>
                <span
                  className="t-val"
                  style={
                    target.kind === "best"
                      ? { color: "var(--amber)" }
                      : undefined
                  }
                >
                  {valLabel}
                </span>
              </div>
              <div className="bar">
                <i style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
