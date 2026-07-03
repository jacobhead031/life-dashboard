"use client";

import { useState, useTransition } from "react";
import { addIdea, archiveIdea } from "@/app/actions";
import type { Idea } from "@/lib/types";

export function IdeasContent({ ideas }: { ideas: Idea[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Add form state
  const [tag, setTag] = useState("");
  const [text, setText] = useState("");
  const [effort, setEffort] = useState("");
  const [isPending, startTransition] = useTransition();

  const active = ideas.filter((i) => !i.archived);
  const archived = ideas.filter((i) => i.archived);

  const allTags = Array.from(new Set(active.map((i) => i.tag).filter(Boolean)));

  const filtered =
    filterTag ? active.filter((i) => i.tag === filterTag) : active;

  function handleAdd() {
    if (!text.trim()) return;
    const data = { tag: tag.trim(), text: text.trim(), effort: effort.trim() };
    setShowAdd(false);
    setTag("");
    setText("");
    setEffort("");
    startTransition(async () => {
      await addIdea(data);
    });
  }

  async function handleArchive(idea: Idea) {
    await archiveIdea(idea.id, true);
  }

  async function handleRestore(idea: Idea) {
    await archiveIdea(idea.id, false);
  }

  return (
    <div>
      <div className="detail-top-row">
        {/* Tag filters */}
        <div className="d-tabs">
          <button
            className={`d-tab${filterTag === null ? " active" : ""}`}
            onClick={() => setFilterTag(null)}
          >
            all{" "}
            <span style={{ opacity: 0.45 }}>({active.length})</span>
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              className={`d-tab${filterTag === t ? " active" : ""}`}
              onClick={() => setFilterTag(filterTag === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          className="btn primary"
          onClick={() => setShowAdd((v) => !v)}
          disabled={isPending}
        >
          {showAdd ? "✕ cancel" : "+ add idea"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="add-panel">
          <div className="add-panel-title">new idea</div>
          <div className="d-form-row">
            <div className="d-field" style={{ flex: 4 }}>
              <label>Idea</label>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What would you pick up if you had 30 minutes?"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
          </div>
          <div className="d-form-row">
            <div className="d-field">
              <label>Tag</label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. guitar, book"
                list="existing-tags"
              />
              <datalist id="existing-tags">
                {allTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="d-field">
              <label>Effort / time</label>
              <input
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                placeholder="e.g. ~ 25 min"
              />
            </div>
          </div>
          <div className="d-form-actions">
            <button
              className="btn primary"
              onClick={handleAdd}
              disabled={!text.trim()}
            >
              Add idea
            </button>
            <button className="btn" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active ideas */}
      {filtered.length === 0 ? (
        <div className="card-full" style={{ padding: "22px" }}>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            {filterTag
              ? `No active ideas tagged "${filterTag}".`
              : "No ideas yet — add the first thing you'd pick up when bored."}
          </p>
        </div>
      ) : (
        <div className="card-full">
          {filtered.map((idea) => (
            <div key={idea.id} className="d-item">
              <div className="d-item-main">
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  {idea.tag && <span className="tag-pill">{idea.tag}</span>}
                  <span className="d-item-title">{idea.text}</span>
                </div>
                {idea.effort && (
                  <div className="d-item-meta">{idea.effort}</div>
                )}
              </div>
              <div className="d-item-actions">
                <button
                  className="d-btn"
                  onClick={() => handleArchive(idea)}
                  title="Archive this idea"
                >
                  archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived section */}
      {archived.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            className="d-btn"
            style={{ marginBottom: 12 }}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "▴" : "▾"} archived ({archived.length})
          </button>

          {showArchived && (
            <div className="card-full" style={{ opacity: 0.7 }}>
              {archived.map((idea) => (
                <div key={idea.id} className="d-item">
                  <div className="d-item-main">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      {idea.tag && (
                        <span
                          className="tag-pill"
                          style={{ opacity: 0.6 }}
                        >
                          {idea.tag}
                        </span>
                      )}
                      <span
                        className="d-item-title"
                        style={{
                          textDecoration: "line-through",
                          color: "var(--muted)",
                        }}
                      >
                        {idea.text}
                      </span>
                    </div>
                    {idea.effort && (
                      <div className="d-item-meta">{idea.effort}</div>
                    )}
                  </div>
                  <div className="d-item-actions">
                    <button
                      className="d-btn"
                      onClick={() => handleRestore(idea)}
                    >
                      restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
