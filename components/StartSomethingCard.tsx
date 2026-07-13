"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import type { Project } from "@/lib/types";

export function StartSomethingCard({ projects }: { projects: Project[] }) {
  const [idx, setIdx] = useState(0);

  const shuffle = useCallback(() => {
    if (projects.length <= 1) return;
    setIdx((i) => {
      let next: number;
      do { next = Math.floor(Math.random() * projects.length); } while (next === i);
      return next;
    });
  }, [projects.length]);

  const project = projects[idx] ?? null;

  return (
    <section className="card span-4 hero" style={{ animationDelay: ".06s" }}>
      <div className="card-label">what&apos;s next?</div>
      <h2>Pick something up</h2>
      <p className="sub">
        The project you&apos;ve touched least recently — so nothing gets forgotten.
      </p>

      <div className="pick">
        {project ? (
          <>
            <span className={`area-badge ${project.area}`} style={{ fontSize: "10px" }}>{project.area}</span>
            <span className="what">{project.next_action ?? project.title}</span>
            {!project.next_action && (
              <span className="meta" style={{ fontStyle: "italic", color: "var(--muted-2)" }}>no next action set</span>
            )}
          </>
        ) : (
          <span className="what" style={{ color: "var(--muted)" }}>
            No active projects — add one in notes.
          </span>
        )}
      </div>

      <div className="hero-actions">
        {project && (
          <button
            className="btn primary"
            onClick={shuffle}
            disabled={projects.length <= 1}
          >
            ⟳&nbsp;&nbsp;Shuffle
          </button>
        )}
        <Link href="/notes" className="btn">
          Open notes
        </Link>
      </div>
    </section>
  );
}
