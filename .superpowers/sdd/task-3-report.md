# Task 3 Report: Client — dnd-kit sortable to-do list

## What was implemented

All 7 brief steps applied verbatim to `app/notes/[id]/ProjectDetail.tsx` and `app/globals.css`:

1. **Install** — `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` (4 packages added, no peer-dep errors with React 19.2.4).
2. **Imports** — added `reorderNote` to the existing `@/app/actions` import; added the three dnd-kit imports below the existing imports.
3. **`SortableTodoRow`** — added at module scope, after `fmtBytes`, before `ProjectDetail`, exactly as specified (temp-note guard via `isTemp`, drag handle span with `attributes`/`listeners`, checkbox/body/time/delete button).
4. **Sensors + `handleDragEnd`** — added inside `ProjectDetail`, immediately after `handleToggleNote`, exactly as specified including the `ponytail:` comment on the midpoint-position assumption.
5. **Temp-note position** — replaced the Task-1 placeholder `position: 0` in `handleAddNote`'s `temp` object with `Math.min(0, ...notes.map((n) => n.position)) - 1`.
6. **Render swap** — replaced the single partitioned `.map()` block (old lines ~165–189) with the `DndContext`/`SortableContext`/`SortableTodoRow` block for unchecked notes, followed by the plain (non-sortable) block for checked notes. No old markup left behind.
7. **CSS** — appended `.todo-drag-handle` / `.todo-drag-handle:active` rules to the end of `app/globals.css`, using the existing `--muted-2` token.

## Verification

- `npx tsc --noEmit` — clean, no output/errors.
- `npm run build` — clean: "Compiled successfully", TypeScript check passed, all 17 routes generated (static + dynamic), no warnings.

## Files changed

- `package.json` — 3 new dependencies (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- `package-lock.json` — lockfile update for the above
- `app/notes/[id]/ProjectDetail.tsx` — imports, `SortableTodoRow`, sensors/`handleDragEnd`, temp-note position, render swap
- `app/globals.css` — `.todo-drag-handle` styling appended

Commit: `4069627` — "Drag-to-reorder to-dos with dnd-kit (mouse + touch)" (4 files changed, 152 insertions, 10 deletions).

## Self-review findings

- Final file content matches the brief's code blocks verbatim (imports, `SortableTodoRow`, `handleDragEnd` including the `ponytail:` comment, temp-note position expression, render swap, CSS).
- Old partitioned single-`.map()` render block and its row markup are fully removed — no dead code left behind.
- `git status --short` before commit showed exactly the four files the brief lists (`package.json`, `package-lock.json`, `app/notes/[id]/ProjectDetail.tsx`, `app/globals.css`) — nothing extra staged.
- `handleToggleNote`'s existing sink-to-bottom behavior (move toggled-done note to the end of the state array) was untouched — verified it still reads as before the edit.
- Checked-note rows correctly use plain markup (no drag handle, not wrapped in `SortableContext`), matching the brief's note that "a temp note is never done" so no temp guards are needed there.

## Concerns

None. Build and typecheck are clean; diff matches the brief exactly with no additions beyond what was specified.

## Fix: temp notes not droppable

**What changed:** In `app/notes/[id]/ProjectDetail.tsx` line 32, updated `useSortable` call from:
```tsx
useSortable({ id: note.id, disabled: isTemp })
```
to:
```tsx
useSortable({ id: note.id, disabled: { draggable: isTemp, droppable: isTemp } })
```

dnd-kit's boolean `disabled` form only disables dragging, not dropping. Temp notes must be excluded from both drag and drop operations.

**Command run:** `npx tsc --noEmit`

**Output:** (clean, no errors)
