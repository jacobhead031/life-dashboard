import Link from "next/link";
import type { Reflection, ReflectionNote } from "@/lib/types";

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function ReflectionCard({
  reflections,
  notes,
}: {
  reflections: Reflection[];
  notes: ReflectionNote[];
}) {
  return (
    <section className="card span-6 reflect" style={{ animationDelay: ".20s" }}>
      <div className="card-label">
        <span>reflection · no scores, just check in</span>
        <Link href="/reflection" className="card-nav">view →</Link>
      </div>

      {reflections.length === 0 ? (
        <div className="empty-state">
          <p>
            No reflections yet. Add something you want to keep coming back
            to — a value, a relationship, a goal you&rsquo;re growing toward.
          </p>
          <Link href="/reflection" className="empty-link">
            → add a reflection
          </Link>
        </div>
      ) : (
        <div className="r-inner">
          {reflections.map((r, i) => {
            const latestNote = notes.find((n) => n.reflection_id === r.id);
            return (
              <>
                {i > 0 && <div key={`div-${r.id}`} className="r-divider" />}
                <div key={r.id} className="r-item">
                  <div className="r-name">{r.name}</div>
                  {latestNote ? (
                    <div className="r-note">
                      Last note {relativeTime(latestNote.created_at)} —{" "}
                      &ldquo;{latestNote.text}&rdquo;
                    </div>
                  ) : (
                    <div
                      className="r-note"
                      style={{ fontStyle: "italic", color: "var(--muted-2)" }}
                    >
                      No notes yet.
                    </div>
                  )}
                  <Link href="/reflection" className="r-add">
                    + add a thought
                  </Link>
                </div>
              </>
            );
          })}
        </div>
      )}
    </section>
  );
}
