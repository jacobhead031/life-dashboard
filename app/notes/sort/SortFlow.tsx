"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { assignNoteToProject, promoteNoteToProject, deleteNote } from "@/app/actions";
import type { Note, Project } from "@/lib/types";

export function SortFlow({
  inbox,
  projects,
}: {
  inbox: Note[];
  projects: Pick<Project, "id" | "title" | "area" | "status">[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newArea, setNewArea] = useState<"career" | "personal">("career");
  const searchRef = useRef<HTMLInputElement>(null);

  const current = inbox[0];
  const total = inbox.length;

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelected(0);
    setSearch("");
    searchRef.current?.focus();
  }, [current?.id]);

  function afterAction() {
    setSearch("");
    setNewTitle("");
    startTransition(() => { router.refresh(); });
  }

  function handleAssign(projectId: string) {
    startTransition(async () => {
      await assignNoteToProject(current.id, projectId);
      afterAction();
    });
  }

  function handlePromote() {
    const t = newTitle.trim();
    if (!t) return;
    startTransition(async () => {
      await promoteNoteToProject(current.id, t, newArea);
      afterAction();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteNote(current.id);
      afterAction();
    });
  }

  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && filtered[selected]) {
      handleAssign(filtered[selected].id);
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Header */}
      <div className="notes-section-hd" style={{ marginTop: 0 }}>
        <span>sort inbox</span>
        <span style={{ color: "var(--muted-2)" }}>{total} remaining</span>
      </div>

      {/* Current note */}
      <div className="sort-note-body">{current.body}</div>

      <hr className="project-divider" />

      {/* Assign to existing */}
      <div className="project-section-label" style={{ marginBottom: 10 }}>assign to project</div>
      <input
        ref={searchRef}
        className="notes-capture"
        style={{ marginBottom: 8, fontSize: "14px", padding: "10px 14px" }}
        placeholder="search projects…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setSelected(0); }}
        onKeyDown={handleSearchKey}
        disabled={isPending}
        autoFocus
      />
      <div style={{ marginBottom: 16 }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: "13px", color: "var(--muted-2)", padding: "8px 0" }}>no matches</div>
        )}
        {filtered.map((p, i) => (
          <button
            key={p.id}
            className={`sort-project-option${i === selected ? " sel" : ""}`}
            onClick={() => handleAssign(p.id)}
            disabled={isPending}
          >
            <span className={`area-badge ${p.area}`}>{p.area}</span>
            <span className="sort-project-title">{p.title}</span>
            <span className={`sort-status-pill ${p.status}`}>{p.status}</span>
          </button>
        ))}
      </div>

      <hr className="project-divider" />

      {/* New project */}
      <div className="project-section-label" style={{ marginBottom: 10 }}>create new project</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="notes-capture"
          style={{ flex: 1, fontSize: "14px", padding: "10px 14px" }}
          placeholder="project title…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePromote()}
          disabled={isPending}
        />
        <button
          className={`project-field-select area-select ${newArea}`}
          style={{ cursor: "pointer", padding: "8px 12px" }}
          onClick={() => setNewArea((a) => a === "career" ? "personal" : "career")}
        >
          {newArea}
        </button>
      </div>
      <button className="d-btn" onClick={handlePromote} disabled={isPending || !newTitle.trim()}>
        create &amp; attach →
      </button>

      <hr className="project-divider" />

      {/* Delete */}
      <button
        className="d-btn danger"
        style={{ opacity: 0.6 }}
        onClick={handleDelete}
        disabled={isPending}
      >
        delete note
      </button>
    </div>
  );
}
