"use client";

import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { quickCapture } from "@/app/actions";
import type { Project, Note } from "@/lib/types";

function relTime(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function ProjectRow({ project: p }: { project: Project & { notes?: { body: string }[] } }) {
  return (
    <Link href={`/notes/${p.id}`} className="project-row">
      <div className="project-row-top">
        <span className={`area-badge ${p.area}`}>{p.area}</span>
        <span className="project-title">{p.title}</span>
        <span className="project-time">{relTime(p.touched_at)}</span>
      </div>
      {p.notes?.[0] ? (
        <div className="project-next">{p.notes[0].body}</div>
      ) : (
        <div className="project-next missing">add a to-do →</div>
      )}
    </Link>
  );
}

function TitleList({ projects }: { projects: Project[] }) {
  return (
    <div className="card" style={{ padding: "4px 18px", marginBottom: 8 }}>
      {projects.map((p) => (
        <div key={p.id} className="seed-row">
          <span className={`area-badge ${p.area}`}>{p.area}</span>
          <Link href={`/notes/${p.id}`} style={{ color: "inherit", textDecoration: "none", fontSize: "13.5px" }}>
            {p.title}
          </Link>
        </div>
      ))}
    </div>
  );
}

export function NotesView({
  active,
  seeds,
  done,
  inbox,
}: {
  active: Project[];
  seeds: Project[];
  done: Project[];
  inbox: Note[];
}) {
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleCapture() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setFlash(true);
    setTimeout(() => setFlash(false), 2000);
    startTransition(async () => {
      await quickCapture(text);
      inputRef.current?.focus();
    });
  }

  const isEmpty = active.length === 0 && seeds.length === 0 && done.length === 0 && inbox.length === 0;

  return (
    <>
      {/* Quick capture */}
      <div style={{ marginBottom: 8 }}>
        <input
          ref={inputRef}
          className="notes-capture"
          placeholder="capture a thought…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCapture()}
          disabled={isPending}
          autoFocus
        />
        <div className="notes-flash">{flash ? "✓ captured" : ""}</div>
      </div>

      {/* Inbox */}
      {inbox.length > 0 && (
        <>
          <div className="notes-section-hd">
            <span>inbox · {inbox.length} unsorted</span>
            <Link href="/notes/sort" className="card-nav">sort →</Link>
          </div>
          <div className="card" style={{ padding: "4px 18px", marginBottom: 8 }}>
            {inbox.slice(0, 3).map((n) => (
              <div key={n.id} className="inbox-note">{n.body}</div>
            ))}
            {inbox.length > 3 && (
              <div className="inbox-note" style={{ color: "var(--muted-2)", fontStyle: "italic" }}>
                +{inbox.length - 3} more
              </div>
            )}
          </div>
        </>
      )}

      {/* Active */}
      {active.length > 0 && (
        <>
          <div className="notes-section-hd"><span>active</span></div>
          {active.map((p) => <ProjectRow key={p.id} project={p} />)}
        </>
      )}

      {/* Seeds */}
      {seeds.length > 0 && (
        <>
          <div className="notes-section-hd"><span>seeds · {seeds.length}</span></div>
          <TitleList projects={seeds} />
        </>
      )}

      {/* Done */}
      {done.length > 0 && (
        <>
          <div className="notes-section-hd">
            <span style={{ color: "var(--muted-2)" }}>done · {done.length}</span>
          </div>
          <div className="card" style={{ padding: "4px 18px", marginBottom: 8, opacity: 0.6 }}>
            {done.map((p) => (
              <div key={p.id} className="seed-row">
                <span className={`area-badge ${p.area}`}>{p.area}</span>
                <Link href={`/notes/${p.id}`} style={{ color: "var(--muted)", textDecoration: "none", fontSize: "13.5px" }}>
                  {p.title}
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {isEmpty && (
        <div style={{ color: "var(--muted-2)", fontSize: "13.5px", paddingTop: 24 }}>
          Nothing here yet — capture a thought above to get started.
        </div>
      )}
    </>
  );
}
