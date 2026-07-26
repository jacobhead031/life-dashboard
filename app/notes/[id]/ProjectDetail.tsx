"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateProject, addProjectNote, toggleNote, deleteNote, recordProjectFile, deleteProjectFile, deleteProject, reorderNote } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import type { Project, Note, ProjectFile } from "@/lib/types";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function relTime(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function SortableTodoRow({ note, onToggle, onDelete }: {
  note: Note;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isTemp = note.id.startsWith("temp-");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id, disabled: isTemp });
  return (
    <div
      ref={setNodeRef}
      className="note-stream-item"
      style={{
        opacity: isTemp ? 0.5 : isDragging ? 0.7 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { position: "relative" as const, zIndex: 1 } : {}),
      }}
    >
      <span className="todo-drag-handle" {...attributes} {...listeners}>⠿</span>
      <input
        type="checkbox"
        className="todo-check"
        checked={note.done}
        onChange={(e) => onToggle(note.id, e.target.checked)}
        disabled={isTemp}
      />
      <div className="note-stream-body">{note.body}</div>
      <div className="note-stream-time">{relTime(note.created_at)}</div>
      <button
        className="d-btn danger"
        style={{ opacity: 0.5, fontSize: "11px", padding: "2px 6px" }}
        onClick={() => onDelete(note.id)}
        disabled={isTemp}
      >
        ✕
      </button>
    </div>
  );
}

export function ProjectDetail({
  project: initial,
  notes: initialNotes,
  files: initialFiles,
}: {
  project: Project;
  notes: Note[];
  files: ProjectFile[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Editable fields
  const [title, setTitle]           = useState(initial.title);
  const [area, setArea]             = useState(initial.area);
  const [status, setStatus]         = useState(initial.status);
  const [why, setWhy]               = useState(initial.why ?? "");
  const [repoUrl, setRepoUrl]       = useState(initial.repo_url ?? "");
  const [liveUrl, setLiveUrl]       = useState(initial.live_url ?? "");

  const [notes, setNotes]   = useState(initialNotes);
  const [files, setFiles]   = useState(initialFiles);
  const [noteDraft, setNoteDraft] = useState("");
  const [flash, setFlash]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2000);
  }

  function save(data: Parameters<typeof updateProject>[1], msg?: string) {
    startTransition(async () => {
      await updateProject(initial.id, data);
      if (msg) showFlash(msg);
    });
  }

  function handleAddNote() {
    const text = noteDraft.trim();
    if (!text) return;
    const temp: Note = {
      id: "temp-" + Date.now(), user_id: "", project_id: initial.id,
      body: text, source: "manual", done: false,
      position: Math.min(0, ...notes.map((n) => n.position)) - 1,
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [temp, ...prev]);
    setNoteDraft("");
    startTransition(async () => { await addProjectNote(initial.id, text); });
  }

  function handleToggleNote(id: string, done: boolean) {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, done } : n));
      if (!done) return next;
      const toggled = next.find((n) => n.id === id)!;
      return [...next.filter((n) => n.id !== id), toggled];
    });
    startTransition(async () => { await toggleNote(id, done); });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const undone = notes.filter((n) => !n.done);
    const doneNotes = notes.filter((n) => n.done);
    const from = undone.findIndex((n) => n.id === active.id);
    const to = undone.findIndex((n) => n.id === over.id);
    if (from === -1 || to === -1) return;
    const moved = arrayMove(undone, from, to);
    const prevPos = moved[to - 1]?.position;
    const nextPos = moved[to + 1]?.position;
    // ponytail: midpoint assumes positions are monotonic in display order; a
    // recently unchecked item can break that until the next reload — renumber
    // the whole list server-side if ordering ever visibly misbehaves
    const position =
      prevPos !== undefined && nextPos !== undefined ? (prevPos + nextPos) / 2
      : prevPos !== undefined ? prevPos + 1
      : nextPos !== undefined ? nextPos - 1
      : 0;
    moved[to] = { ...moved[to], position };
    setNotes([...moved, ...doneNotes]);
    startTransition(async () => { await reorderNote(String(active.id), position, initial.id); });
  }

  function handleDeleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    startTransition(async () => { await deleteNote(id); });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const path = `${user.id}/${initial.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("project-files").upload(path, file);
    if (!error) {
      await recordProjectFile(initial.id, file.name, path, file.size);
      router.refresh();
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleDeleteFile(fileId: string, path: string) {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    const supabase = createClient();
    await supabase.storage.from("project-files").remove([path]);
    await deleteProjectFile(fileId);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const todoCount = notes.filter((n) => !n.done).length;

  return (
    <>
      {/* Title */}
      <input
        className="project-detail-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const v = title.trim();
          if (v && v !== initial.title) save({ title: v }, "title saved");
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />

      {/* Area · Status · touched */}
      <div className="project-meta-row">
        <select
          className={`project-field-select area-select ${area}`}
          value={area}
          onChange={(e) => { setArea(e.target.value as Project["area"]); save({ area: e.target.value as Project["area"] }); }}
        >
          <option value="career">career</option>
          <option value="personal">personal</option>
        </select>
        <select
          className="project-field-select"
          value={status}
          onChange={(e) => { setStatus(e.target.value as Project["status"]); save({ status: e.target.value as Project["status"] }); }}
        >
          <option value="active">active</option>
          <option value="seed">seed</option>
          <option value="done">done</option>
        </select>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-space-mono)", fontSize: "11px", color: "var(--muted-2)" }}>
          touched {relTime(initial.touched_at)}
        </span>
        {flash && (
          <span style={{ fontFamily: "var(--font-space-mono)", fontSize: "11px", color: "var(--green)" }}>
            ✓ {flash}
          </span>
        )}
      </div>

      {/* To-do list */}
      <div className="project-section">
        <div className="project-section-label">
          to do{todoCount > 0 ? ` · ${todoCount}` : ""}
        </div>
        {notes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={notes.filter((n) => !n.done).map((n) => n.id)} strategy={verticalListSortingStrategy}>
                {notes.filter((n) => !n.done).map((n) => (
                  <SortableTodoRow key={n.id} note={n} onToggle={handleToggleNote} onDelete={handleDeleteNote} />
                ))}
              </SortableContext>
            </DndContext>
            {notes.filter((n) => n.done).map((n) => (
              <div key={n.id} className="note-stream-item done">
                <input
                  type="checkbox"
                  className="todo-check"
                  checked={n.done}
                  onChange={(e) => handleToggleNote(n.id, e.target.checked)}
                />
                <div className="note-stream-body">{n.body}</div>
                <div className="note-stream-time">{relTime(n.created_at)}</div>
                <button
                  className="d-btn danger"
                  style={{ opacity: 0.5, fontSize: "11px", padding: "2px 6px" }}
                  onClick={() => handleDeleteNote(n.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          className="note-add-area"
          placeholder="add a to-do… (⌘↵ to save)"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote();
          }}
        />
        <button
          className="d-btn"
          onClick={handleAddNote}
          disabled={isPending || !noteDraft.trim()}
        >
          add
        </button>
      </div>

      <hr className="project-divider" />

      {/* Why */}
      <div className="project-section">
        <div className="project-section-label">why</div>
        <textarea
          className="project-why-input"
          placeholder="what's the real reason this matters?"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          onBlur={() => {
            const v = why.trim() || null;
            if (v !== (initial.why ?? null)) save({ why: v });
          }}
          rows={3}
        />
      </div>

      {/* Links */}
      <div className="project-section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div className="project-section-label" style={{ marginBottom: 4 }}>repo</div>
          <input
            className="project-link-input"
            placeholder="https://github.com/…"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onBlur={() => {
              const v = repoUrl.trim() || null;
              if (v !== (initial.repo_url ?? null)) save({ repo_url: v });
            }}
          />
        </div>
        <div>
          <div className="project-section-label" style={{ marginBottom: 4 }}>live</div>
          <input
            className="project-link-input"
            placeholder="https://…"
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            onBlur={() => {
              const v = liveUrl.trim() || null;
              if (v !== (initial.live_url ?? null)) save({ live_url: v });
            }}
          />
        </div>
      </div>

      <hr className="project-divider" />

      {/* Files */}
      <div className="project-section">
        <div className="project-section-label">
          files{files.length > 0 ? ` · ${files.length}` : ""}
        </div>
        {files.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {files.map((f) => (
              <div key={f.id} className="file-item">
                <span style={{ fontSize: "15px" }}>📄</span>
                <a
                  className="file-item-name"
                  href={`${supabaseUrl}/storage/v1/object/public/project-files/${f.path}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {f.name}
                </a>
                <span className="file-item-size">{fmtBytes(f.size)}</span>
                <button
                  className="d-btn danger"
                  style={{ opacity: 0.5, fontSize: "11px", padding: "2px 6px" }}
                  onClick={() => handleDeleteFile(f.id, f.path)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        <button
          className="d-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "uploading…" : "↑ attach file"}
        </button>
      </div>

      <hr className="project-divider" />

      {/* Delete project */}
      <div style={{ paddingBottom: 40 }}>
        <button
          className="d-btn danger"
          style={{ opacity: 0.5 }}
          onClick={() => {
            if (!confirm(`Delete "${initial.title}"? This can't be undone.`)) return;
            startTransition(async () => {
              await deleteProject(initial.id);
              router.push("/notes");
            });
          }}
          disabled={isPending}
        >
          delete project
        </button>
      </div>
    </>
  );
}
