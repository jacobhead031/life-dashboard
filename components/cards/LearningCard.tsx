import Link from "next/link";
import type { LearningTrack } from "@/lib/types";

// r=16 → circumference = 2π×16 ≈ 100.53
const CIRC = 2 * Math.PI * 16;

export function LearningCard({ tracks }: { tracks: LearningTrack[] }) {
  return (
    <section className="card span-3" style={{ animationDelay: ".12s" }}>
      <div className="card-label">
        <span>learning tracks</span>
        <Link href="/learning" className="card-nav">view →</Link>
      </div>

      {tracks.length === 0 ? (
        <div className="empty-state">
          <p>No tracks yet. Add a course or skill you&rsquo;re working through.</p>
          <Link href="/learning" className="empty-link">
            → add a track
          </Link>
        </div>
      ) : (
        tracks.map((track) => {
          const pct =
            track.total_steps > 0
              ? track.completed_steps / track.total_steps
              : 0;
          const strokeColor =
            track.accent === "amber" ? "var(--amber)" : "var(--sky)";
          const offset = CIRC * (1 - pct);
          const pctLabel = `${Math.round(pct * 100)}%`;
          const metaLabel =
            pct === 0
              ? "not started"
              : track.current_label ||
                `${track.completed_steps} of ${track.total_steps}`;

          return (
            <div key={track.id} className="lrow">
              <svg className="ring" viewBox="0 0 40 40" aria-hidden="true">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="4"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={offset}
                  transform="rotate(-90 20 20)"
                />
              </svg>
              <div>
                <div className="l-name">{track.name}</div>
                <div className="l-meta">{metaLabel}</div>
              </div>
              <span className="l-pct">{pctLabel}</span>
            </div>
          );
        })
      )}
    </section>
  );
}
