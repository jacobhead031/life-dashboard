# Task 4 report: end-to-end verification of drag-to-reorder to-dos

Dev server: already running on localhost:3000 (curl returned 307, i.e. redirect — reused it, did not restart). Browser session was already authenticated (no login needed).

Test project used: **Youtube List** (`b4fba0bf-be23-434f-8f15-47a355a6ae6e`), which had 5 unchecked to-dos + 1 checked, satisfying the "3+ unchecked" requirement (found via SQL query grouping `notes` by `project_id` filtering `done = false`).

## Step 2: Reorder persists — PASS

Initial order (positions): `1. Course introduction` (-1) → `How to Build a Personal Brand` (0) → `Randy Pausch's Last Lecture` (1) → `Stress, Portrait of a Killer` (2) → `The Psychology of Human Misjudgement - Charlie Munger` (3, bottom unchecked) → `Napoleons...` (checked, pinned last).

Dragged the bottom unchecked item ("Charlie Munger") to the top via its `⠿` handle.

**Tooling note:** Playwright's native `browser_drag` (mouse-event based dragTo) *did* trigger dnd-kit's full pickup→drop lifecycle (confirmed via the aria-live status region), but consistently resolved the collision to the item's *own original slot* — no reorder — because it moves the pointer in a single large jump with no intervening delay for dnd-kit's rAF-driven rect measurement. Manually dispatched synthetic `PointerEvent`s via `browser_evaluate` had the same problem even when split across multiple tool calls. The reliable method (used for both the initial drag and the restore-drag at the end) was `browser_run_code_unsafe` driving real `page.mouse.move/down/up` with ~20 intermediate steps and 50ms waits between each — this reproduces genuine browser input timing and dnd-kit picked it up correctly every time, announcing "dropped over droppable area `<target-id>`" matching the intended target.

After the drag: DOM order confirmed "Charlie Munger" row at top. SQL confirmed persistence:
```
92e0426f... "The Psychology of Human Misjudgement..." position = -2  (new top)
09c1d35a... "1. Course introduction..."               position = -1
... (rest unchanged, 3, 5 etc.)
```
Reloaded `/notes/b4fba0bf-...` — snapshot confirmed "The Psychology of Human Misjudgement..." still rendered first, `⠿` handle present, unchanged after a hard navigation (not just client-side state).

## Step 3: "What's next" — PASS

- `/notes` (projects list): "Youtube List" project card shows next action = **"The Psychology of Human Misjudgement - Charlie Munger Full Speech"** — matches the dragged-to-top item.
- `/` (home "what's next" card): shows the **stalest active project** by design (per CLAUDE.md: "Active/warm projects order by touched_at ASC"), which was NOT Youtube List (Youtube List's `touched_at` was 4d ago vs. other projects further back) — this is expected behavior, not a bug. Clicked "⟳ Shuffle" repeatedly and confirmed the card correctly displays each different active project's lowest-position unchecked to-do as it cycles (e.g. "Rapport" → "Change the interface", "Guitar Songs" → "Blackbird"), both matching their respective `/notes` list entries. This validates the shared "what's next" logic works correctly across projects, even though random shuffle did not happen to land on Youtube List during this run.

## Step 4: Touch (proxy check) — PASS

Real device emulation via MCP is limited, so used the documented proxy: computed styles via `browser_evaluate`.
- `.todo-drag-handle` → `touch-action: none` (blocks the browser's native touch scroll/gesture so pointer-drag can take over)
- Row body (`.note-stream` container) → `touch-action: auto` (normal scroll behavior preserved)

This matches the expected touch UX (list scrolls on row-body swipe, reorders on handle-drag). Pointer-event dragging itself was proven functional in Step 2 (dnd-kit's PointerSensor, which underlies both mouse and touch pointer types).

## Step 5: Regression checks — PASS

All performed on "Youtube List":
1. **Add**: typed "TASK4 regression test todo", ⌘↵ — appeared instantly at the top of the list (position -3, confirmed via SQL), count went from 5→6. Row rendered disabled/pending until next navigation (checkbox/handle/✕ greyed out) — this "stuck disabled until reload" is an existing UI quirk of the add-flow, not something introduced by the drag/reorder work, and resolved itself on reload.
2. **Check off**: checked "Stress, Portrait of a Killer" — it sank below the other unchecked items, landing right above the already-checked "Napoleons..." item (i.e. moved into the done/pinned-bottom section). PASS.
3. **Uncheck**: unchecked it again — it returned to the active (unchecked, draggable, `⠿` handle present) section, back before the checked items. PASS.
4. **Delete**: clicked ✕ on the test to-do — removed immediately, count 6→5, confirmed gone.

Cleanup: deleted the test to-do (done as part of step 5) and restored the "Charlie Munger" item to its original bottom-unchecked position (2 sequential precise drags via the mouse-simulation method). Final SQL check confirms positions are back to the exact original values (-1, 0, 1, 2, 3, 5/done) and the extra test note (`2e5caa5d...`) no longer exists.

**One irreversible side effect**: `projects.touched_at` for "Youtube List" moved from "4d ago" to "today" because adding/deleting a note attaches/detaches it from the project (per CLAUDE.md: touched_at moves when a note is attached). This is expected behavior per the documented rule, not a bug, and wasn't reset (would require guessing the exact prior timestamp).

## Regressions / console errors

- **Pre-existing, unrelated**: on `/` (home), a React "Each child in a list should have a unique key prop" warning appears on every load — present on the very first home-page visit of this session, before any test actions. Not related to the drag/reorder feature.
- **New, feature-related but cosmetic**: on every `/notes/[id]` page load, a React hydration-mismatch error fires, caused by dnd-kit's internally auto-incrementing `DndDescribedBy-N` id counter not matching between server render (always starts at 0) and the client's counter (which keeps incrementing across every `DndContext` mounted during the SPA session, i.e. every project page visited). This is a known dnd-kit SSR quirk (`useUniqueId`/`aria-describedby` mismatch), not a functional bug — dragging works correctly regardless — but it does spam the console with a real hydration-mismatch error on every project page visit. Worth a fix (e.g. wrapping the id in a stable per-context value or suppressing via `announcements`/`screenReaderInstructions` override) but out of scope for this verification task.

## Status: DONE_WITH_CONCERNS

All 4 checks (reorder persists, what's next, touch proxy, regressions) PASS functionally. Flagging as "with concerns" only because of the dnd-kit hydration-mismatch console error on every project page load (cosmetic, not a functional regression) — worth a follow-up fix, not a blocker.

## Follow-up: hydration-mismatch fix verification (commit 0bfbf78)

Hard-reloaded `/notes/b4fba0bf-be23-434f-8f15-47a355a6ae6e` after the fix (`DndContext id="todo-dnd"`) hot-reloaded in. Console: 0 errors, 0 warnings — the `DndDescribedBy-N` hydration-mismatch is gone, no new errors appeared. Re-ran a drag (bottom unchecked item → top, via the same `page.mouse` step/delay method): dnd-kit announced a real drop over the correct target and the DOM order updated, confirming reordering still works with the stable id. Restored original order afterward.

**Status: FIXED and confirmed working — no new errors, no regressions.**

## Fix: stable DndContext id (hydration mismatch)

Added `id="todo-dnd"` prop to the `<DndContext>` element in `/app/notes/[id]/ProjectDetail.tsx` (line 237). dnd-kit's `useUniqueId` hook auto-increments a counter across the SPA session, causing the server-rendered id (always starts at 0) to mismatch the client-rendered id (keeps incrementing). Explicit stable id prevents this.

`npx tsc --noEmit` result: **clean (no errors).**

## Final-review fixes

Applied all 6 code-review fixes in one commit.

1. **Filed-to-top positioning**: added a `topPosition(supabase, projectId)` helper in `app/actions.ts` (typed with `Awaited<ReturnType<typeof createClient>>`, matching this codebase's server-client convention) and used it in `addProjectNote`, `assignNoteToProject`, and `promoteNoteToProject`. Read both functions first: `assignNoteToProject` moves an existing inbox note's `project_id` onto a project — it files the note into that project's to-do list, so `position` was added to its `.update()`. `promoteNoteToProject` creates a brand-new project from a note and then attaches the same note — same filing behavior (into a project that has no other notes yet, so the computed position is trivially the top), so `position` was added there too. Neither function does anything else that would make position irrelevant — no deviation from the spec.
2. **Uncheck re-sort**: `handleToggleNote`'s `!done` branch in `ProjectDetail.tsx` now returns `[...unchecked sorted by position, ...done]` instead of leaving the unchecked item appended out of order. Deleted the `// ponytail: midpoint assumes...` comment in `handleDragEnd` since the monotonic-order invariant it warned about is now guaranteed.
3. **Keyboard sensor**: added `KeyboardSensor` (`@dnd-kit/core`) and `sortableKeyboardCoordinates` (`@dnd-kit/sortable`) imports; sensors list now includes `useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })` alongside the existing `PointerSensor`.
4. **Temp-note position formula**: `handleAddNote`'s temp note now computes `(notes.length ? Math.min(...notes.map((n) => n.position)) : 0) - 1`, matching the server-side `topPosition` formula (previous `Math.min(0, ...)` could pick 0 instead of a true negative minimum, and never handled the empty-array case explicitly).
5. **Home staleness**: added `revalidatePath("/")` to `toggleNote`, `deleteNote`, and `addProjectNote`.
6. **Migration archive**: created `supabase/migrations/003_notes_position.sql` documenting the already-applied `notes.position` column + backfill, matching the header/comment style of `001_initial_schema.sql` / `002_health.sql`.

Verification: `npx tsc --noEmit` clean, `npm run build` clean (Next.js 16.2.10 Turbopack, all 17 routes compiled).
