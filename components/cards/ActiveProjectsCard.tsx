import Link from "next/link";
import type { Project } from "@/lib/types";

// Stalest first (the query orders by touched_at), each with its next unchecked to-do.
export function ActiveProjectsCard({ projects }: { projects: (Project & { notes?: { body: string }[] })[] }) {
  return (
    <section className="card span-4 hero" style={{ animationDelay: ".06s" }}>
      <div className="card-label">
        <span>active projects{projects.length > 0 ? ` · ${projects.length}` : ""}</span>
        <Link href="/notes" className="card-nav">all projects →</Link>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <p>No active projects.</p>
          <Link href="/notes" className="empty-link">→ start one</Link>
        </div>
      ) : (
        projects.map((p) => (
          <Link key={p.id} href={`/notes/${p.id}`} className="proj-row">
            <span className={`area-badge ${p.area}`} style={{ fontSize: "10px" }}>{p.area}</span>
            <span className="proj-main">
              <span className="proj-title">{p.title}</span>
              <span className="proj-next">{p.notes?.[0] ? `→ ${p.notes[0].body}` : "no to-dos yet"}</span>
            </span>
          </Link>
        ))
      )}
    </section>
  );
}
