"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import type { Idea } from "@/lib/types";

export function StartSomethingCard({ ideas }: { ideas: Idea[] }) {
  const [idx, setIdx] = useState(() =>
    ideas.length > 0 ? Math.floor(Math.random() * ideas.length) : -1
  );

  const shuffle = useCallback(() => {
    if (ideas.length <= 1) return;
    let next: number;
    do {
      next = Math.floor(Math.random() * ideas.length);
    } while (next === idx);
    setIdx(next);
  }, [ideas.length, idx]);

  const idea = idx >= 0 ? ideas[idx] : null;

  return (
    <section className="card span-4 hero" style={{ animationDelay: ".06s" }}>
      <div className="card-label">got a minute?</div>
      <h2>Start something</h2>
      <p className="sub">
        Nothing pressing? Here&rsquo;s one thing you could pick up right now.
      </p>

      <div className="pick">
        {idea ? (
          <>
            <span className="tag">{idea.tag}</span>
            <span className="what">{idea.text}</span>
            {idea.effort && <span className="meta">{idea.effort}</span>}
          </>
        ) : (
          <span className="what" style={{ color: "var(--muted)" }}>
            No ideas yet — add the first thing you&rsquo;d pick up when bored.
          </span>
        )}
      </div>

      <div className="hero-actions">
        {idea && (
          <button
            className="btn primary"
            onClick={shuffle}
            disabled={ideas.length <= 1}
          >
            ⟳&nbsp;&nbsp;Shuffle
          </button>
        )}
        <Link href="/ideas" className="btn">
          See all ideas
        </Link>
      </div>
    </section>
  );
}
