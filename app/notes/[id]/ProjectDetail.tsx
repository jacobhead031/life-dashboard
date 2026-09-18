"use client";

import { useState, useTransition, useOptimistic, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateProject, addProjectNote, toggleNote, deleteNote, recordProjectFile, deleteProjectFile, deleteProject, reorderNote } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import type { Project, Note, ProjectFile } from "@/lib/types";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
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

type NoteOp =
  | { type: "add"; note: Note }
  | { type: "patch"; id: string; patch: Partial<Note> }
  | { type: "delete"; id: string };

function SortableTodoRow({ note, onToggle, onDelete }: {
  note: Note;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isTemp = note.id.startsWith("temp-");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id, disabled: { draggable: isTemp, droppable: isTemp } });
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
        aria-label={`Mark ${note.body} done`}
      />
      <div className="note-stream-body">{note.body}</div>
      <div className="note-stream-time">{relTime(note.created_at)}</div>
      <button
        className="d-btn danger"
        style={{ opacity: 0.5, fontSize: "11px", padding: "2px 6px" }}
        onClick={() => onDelete(note.id)}
        disabled={isTemp}
        aria-label={`Delete ${note.body}`}
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
  files: (ProjectFile & { url?: string })[];
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

  // Optimistic over props, so revalidated rows replace temp ones when the action lands.
  const [notes, patchNotes] = useOptimistic(initialNotes, (state, op: NoteOp) =>
    op.type === "add" ? [...state, op.note]
    : op.type === "delete" ? state.filter((n) => n.id !== op.id)
    : state.map((n) => (n.id === op.id ? { ...n, ...op.patch } : n)),
  );
  const [files, removeFile] = useOptimistic(initialFiles, (state, id: string) => state.filter((f) => f.id !== id));
  // Order comes from the data: open by position, done after.
  const open = notes.filter((n) => !n.done).sort((a, b) => a.position - b.position);
  const doneNotes = notes.filter((n) => n.done);
  const [noteDraft, setNoteDraft] = useState("");
  const [flash, setFlash]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
      position: (notes.length ? Math.min(...notes.map((n) => n.position)) : 0) - 1,
      created_at: new Date().toISOString(),
    };
    setNoteDraft("");
    startTransition(async () => {
      patchNotes({ type: "add", note: temp });
      await addProjectNote(initial.id, text);
    });
  }

  function handleToggleNote(id: string, done: boolean) {
    startTransition(async () => {
      patchNotes({ type: "patch", id, patch: { done } });
      await toggleNote(id, done);
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = open.findIndex((n) => n.id === active.id);
    const to = open.findIndex((n) => n.id === over.id);
    if (from === -1 || to === -1) return;
    const moved = arrayMove(open, from, to);
    const prevPos = moved[to - 1]?.position;
    const nextPos = moved[to + 1]?.position;
    const position =
      prevPos !== undefined && nextPos !== undefined ? (prevPos + nextPos) / 2
      : prevPos !== undefined ? prevPos + 1
      : nextPos !== undefined ? nextPos - 1
      : 0;
    startTransition(async () => {
      patchNotes({ type: "patch", id: String(active.id), patch: { position } });
      await reorderNote(String(active.id), position, initial.id);
    });
  }

  function handleDeleteNote(id: string) {
    startTransition(async () => {
      patchNotes({ type: "delete", id });
      await deleteNote(id);
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");
      const path = `${user.id}/${initial.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("project-files").upload(path, file);
      if (error) throw error;
      try {
        await recordProjectFile(initial.id, file.name, path, file.size);
      } catch (err) {
        // No row means nothing would ever list or delete the object.
        await supabase.storage.from("project-files").remove([path]);
        throw err;
      }
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "upload failed");
    }
    setUploading(false);
    e.target.value = "";
  }

  function handleDeleteFile(fileId: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    startTransition(async () => {
      removeFile(fileId);
      await deleteProjectFile(fileId);
    });
  }

  const todoCount = open.length;

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
        aria-label="Project title"
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
            <DndContext id="todo-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={open.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                {open.map((n) => (
                  <SortableTodoRow key={n.id} note={n} onToggle={handleToggleNote} onDelete={handleDeleteNote} />
                ))}
              </SortableContext>
            </DndContext>
            {doneNotes.map((n) => (
              <div key={n.id} className="note-stream-item done">
                <input
                  type="checkbox"
                  className="todo-check"
                  checked={n.done}
                  onChange={(e) => handleToggleNote(n.id, e.target.checked)}
                  aria-label={`Mark ${n.body} not done`}
                />
                <div className="note-stream-body">{n.body}</div>
                <div className="note-stream-time">{relTime(n.created_at)}</div>
                <button
                  className="d-btn danger"
                  style={{ opacity: 0.5, fontSize: "11px", padding: "2px 6px" }}
                  onClick={() => handleDeleteNote(n.id)}
                  aria-label={`Delete ${n.body}`}
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
                {f.url ? (
                  <a className="file-item-name" href={f.url} target="_blank" rel="noreferrer">
                    {f.name}
                  </a>
                ) : (
                  <span style={{ flex: 1, fontSize: "13.5px", color: "var(--muted)" }}>{f.name}</span>
                )}
                <span className="file-item-size">{fmtBytes(f.size)}</span>
                <button
                  className="d-btn danger"
                  style={{ opacity: 0.5, fontSize: "11px", padding: "2px 6px" }}
                  onClick={() => handleDeleteFile(f.id, f.name)}
                  aria-label={`Delete ${f.name}`}
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
        {uploadError && (
          <div style={{ marginTop: 8, fontFamily: "var(--font-space-mono)", fontSize: "11px", color: "var(--coral)" }}>
            upload failed: {uploadError}
          </div>
        )}
      </div>

      <hr className="project-divider" />

      {/* Delete project */}
      <div style={{ paddingBottom: 40 }}>
        <button
          className="d-btn danger"
          style={{ opacity: 0.5 }}
          onClick={() => {
            if (!confirm(`Delete "${initial.title}"? Its to-dos move to the inbox. This can't be undone.`)) return;
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
