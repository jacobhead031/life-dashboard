# Drag-to-Reorder To-Do List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Press-and-drag to-dos into any order on the project page (mouse + touch); the top item becomes "what's next" everywhere.

**Architecture:** A `position double precision` column on `notes` is the persistent order. A drag updates exactly one row (midpoint of new neighbors). All three "what's next" reads switch from newest-`created_at` to lowest-`position`. dnd-kit provides touch-capable sorting in the existing `ProjectDetail` client component.

**Tech Stack:** Next.js 16 / React 19, Supabase (remote DB via MCP `apply_migration`), `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.

**Spec:** `docs/superpowers/specs/2026-07-26-todo-drag-reorder-design.md`

## Global Constraints

- App root is `life-dashboard/` inside the workspace — all paths below are relative to it.
- This Next.js version has breaking changes vs training data (see `AGENTS.md`); check `node_modules/next/dist/docs/` if an API surprises you.
- No test framework exists in this repo; verification is `npx tsc --noEmit`, `npm run build`, and live browser checks (Playwright MCP or manual). Do not add a test framework.
- Supabase table `notes` lives ONLY in the remote project (local `supabase/migrations/` does not define it). Apply schema changes with the Supabase MCP `apply_migration` tool.
- Commit after every task. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `position` column — DB, type, docs

**Files:**
- Remote DB: migration `add_notes_position` via Supabase MCP
- Modify: `lib/types.ts` (Note type, ~line 136)
- Modify: `CLAUDE.md` (notes schema block)

**Interfaces:**
- Produces: `notes.position double precision not null default 0` — lower = higher in list; backfilled to match today's visual order (`created_at desc` → 0,1,2… per project). `Note.position: number` in TypeScript.

- [ ] **Step 1: Apply the migration** via MCP tool `mcp__supabase__apply_migration`, name `add_notes_position`:

```sql
alter table notes add column if not exists position double precision not null default 0;

update notes set position = sub.rn
from (
  select id, row_number() over (partition by project_id order by created_at desc) - 1 as rn
  from notes
) sub
where notes.id = sub.id;
```

(`default 0` keeps ad-hoc terminal inserts working; they land near the top.)

- [ ] **Step 2: Verify backfill** via `mcp__supabase__execute_sql`:

```sql
select project_id, position, done, left(body, 30)
from notes order by project_id nulls first, position asc limit 20;
```

Expected: within each `project_id`, `position` runs 0,1,2… in newest-first `created_at` order, no NULLs.

- [ ] **Step 3: Add the field to the Note type** in `lib/types.ts`:

```ts
export type Note = {
  id: string;
  user_id: string;
  project_id: string | null;
  body: string;
  source: string;
  done: boolean;
  position: number;
  created_at: string;
};
```

- [ ] **Step 4: Update `CLAUDE.md`** — in the `### notes` schema block, change the column list line to:

```sql
id uuid, user_id uuid, project_id uuid (nullable), body text,
source text, done boolean (default false),
position double precision (default 0, lower = higher in the to-do list), created_at timestamptz
```

And in "Key rules", replace the `next_action` bullet's definition of "what's next" with: the **lowest-`position` unchecked to-do** (`notes` where `done = false`, `order by position asc`).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit` — expected: no output.

```bash
git add lib/types.ts CLAUDE.md
git commit -m "Add notes.position column for manual to-do ordering"
```

---

### Task 2: Server — ordering queries and actions

**Files:**
- Modify: `app/actions.ts` (`addProjectNote` at ~430; new `reorderNote` next to `toggleNote` at ~440)
- Modify: `app/notes/[id]/page.tsx:18`
- Modify: `app/page.tsx:116`
- Modify: `app/notes/page.tsx:18`

**Interfaces:**
- Consumes: `notes.position` from Task 1.
- Produces: `reorderNote(noteId: string, position: number, projectId: string): Promise<void>` server action; all note lists ordered by `position asc`; new notes inserted with `min(position) - 1`.

- [ ] **Step 1: Order the project page by position** — `app/notes/[id]/page.tsx` line 18, change:

```ts
supabase.from("notes").select("*").eq("project_id", id).order("position", { ascending: true }),
```

- [ ] **Step 2: Swap "what's next" ordering on the home page** — `app/page.tsx` (~line 116), in the `projects` query change only the referenced-table order line:

```ts
.order("position", { referencedTable: "notes", ascending: true })
```

(was `.order("created_at", { referencedTable: "notes", ascending: false })`; keep the surrounding `.eq("notes.done", false)` and `.limit(1, { referencedTable: "notes" })`.)

- [ ] **Step 3: Same swap on the projects list** — `app/notes/page.tsx` (~line 18), identical one-line change as Step 2.

- [ ] **Step 4: Insert new notes at the top** — in `app/actions.ts`, replace `addProjectNote`:

```ts
export async function addProjectNote(projectId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: top } = await supabase
    .from("notes").select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  const position = (top?.position ?? 0) - 1;
  await supabase.from("notes").insert({ user_id: user.id, project_id: projectId, body, source: "manual", position });
  await supabase.from("projects").update({ touched_at: new Date().toISOString() }).eq("id", projectId);
  revalidatePath(`/notes/${projectId}`);
  revalidatePath("/notes");
}
```

- [ ] **Step 5: Add the reorder action** — in `app/actions.ts`, directly after `toggleNote`:

```ts
export async function reorderNote(noteId: string, position: number, projectId: string) {
  const supabase = await createClient();
  await supabase.from("notes").update({ position }).eq("id", noteId);
  revalidatePath(`/notes/${projectId}`);
  revalidatePath("/notes");
  revalidatePath("/");
}
```

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit` — expected: no output.

```bash
git add app/actions.ts "app/notes/[id]/page.tsx" app/page.tsx app/notes/page.tsx
git commit -m "Order to-dos by position; reorderNote action; new notes insert at top"
```

---

### Task 3: Client — dnd-kit sortable list

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `app/notes/[id]/ProjectDetail.tsx`
- Modify: `app/globals.css` (append)

**Interfaces:**
- Consumes: `reorderNote(noteId, position, projectId)` from Task 2; `Note.position` from Task 1.
- Produces: drag-reorderable unchecked list; checked items pinned at bottom, not draggable.

- [ ] **Step 1: Install dnd-kit**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: added to `dependencies`, no peer-dep errors (React 19 is supported).

- [ ] **Step 2: Imports** — in `app/notes/[id]/ProjectDetail.tsx`, add below the existing imports, and add `reorderNote` to the `@/app/actions` import:

```tsx
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

- [ ] **Step 3: Sortable row component** — add at module scope (after `fmtBytes`, before `ProjectDetail`):

```tsx
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
```

- [ ] **Step 4: Sensors + drag handler** — inside `ProjectDetail`, after the `handleToggleNote` function add:

```tsx
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
```

- [ ] **Step 5: Give the optimistic temp note a position** — in `handleAddNote`, add to the `temp` object literal:

```tsx
position: Math.min(0, ...notes.map((n) => n.position)) - 1,
```

- [ ] **Step 6: Replace the list render** — swap the single partition `.map()` block (the `{[...notes.filter((n) => !n.done), ...notes.filter((n) => n.done)].map((n) => ( ... ))}` expression and its whole row markup, currently ~lines 165–189) with:

```tsx
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
```

(Done rows keep plain markup — no handle, not draggable. Temp-note guards are only needed in the sortable row; a temp note is never done.)

- [ ] **Step 7: Handle styling** — append to `app/globals.css`:

```css
.todo-drag-handle {
  cursor: grab;
  touch-action: none; /* required: lets dnd-kit own the gesture instead of page scroll */
  user-select: none;
  color: var(--muted-2);
  font-size: 12px;
  padding: 2px 4px;
  flex-shrink: 0;
}
.todo-drag-handle:active { cursor: grabbing; }
```

- [ ] **Step 8: Build and commit**

Run: `npx tsc --noEmit` then `npm run build` — expected: both clean.

```bash
git add package.json package-lock.json "app/notes/[id]/ProjectDetail.tsx" app/globals.css
git commit -m "Drag-to-reorder to-dos with dnd-kit (mouse + touch)"
```

---

### Task 4: End-to-end verification and deploy

**Files:** none (verification + push)

- [ ] **Step 1: Start the app**: `npm run dev` (background). Log in at `localhost:3000` if needed (Playwright MCP or manual).

- [ ] **Step 2: Verify reorder persists**: open a project with 3+ unchecked to-dos, drag the bottom unchecked item to the top (grab the ⠿ handle), reload the page. Expected: new order survives reload.

- [ ] **Step 3: Verify "what's next"**: visit `/` (home card) and `/notes` (projects list). Expected: both show the item you dragged to the top as that project's next action.

- [ ] **Step 4: Verify touch**: in browser DevTools device emulation (e.g. iPhone), drag by the handle. Expected: list scrolls when swiping the row body, reorders when dragging the handle.

- [ ] **Step 5: Verify nothing regressed**: add a new to-do (appears at top), check one off (sinks to bottom), uncheck it (returns to active section), delete one.

- [ ] **Step 6: Deploy**

```bash
git push
```

Expected: push to `main` triggers the production rebuild (~1–2 min).
