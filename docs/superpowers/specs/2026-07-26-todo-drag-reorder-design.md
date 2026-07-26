# Drag-to-reorder the project to-do list

**Date:** 2026-07-26 · **Status:** approved

## Goal

On a project page, press-and-drag a to-do to any spot in the list, on both desktop (mouse) and phone (touch). The item dragged to the top becomes the project's "what's next" everywhere (home card, projects list, project page).

## Database

- Add `position double precision` to `notes`, backfilled from the current display order (`created_at desc` → position 0, 1, 2, …) so nothing visibly moves on deploy.
- New notes get `min(position) - 1` for their project (land on top, matching today's prepend behavior). Inbox notes (`project_id is null`) also get a position but are unaffected otherwise.
- A drag updates **one row**: the moved note's `position` becomes the midpoint of its new neighbors (`(prev + next) / 2`; top = `first - 1`, bottom = `last + 1`). No renumbering of siblings.

## Ordering changes

| Where | Was | Becomes |
|---|---|---|
| Project page notes query (`app/notes/[id]/page.tsx`) | `created_at desc` | `position asc` |
| Home card "what's next" (`app/page.tsx`) | newest unchecked note | lowest-`position` unchecked note |
| Projects list "what's next" (`app/notes/page.tsx`) | newest unchecked note | lowest-`position` unchecked note |

## UI (`app/notes/[id]/ProjectDetail.tsx`)

- Library: `@dnd-kit/core` + `@dnd-kit/sortable` (touch + mouse + keyboard).
- Only **unchecked** items are sortable; checked items stay pinned at the bottom, not draggable.
- On drop: reorder local state immediately (optimistic), then call a new server action `reorderNote(id, position)` inside `startTransition`.
- Check-off behavior unchanged: checking an item still sinks it to the bottom.

## Out of scope

Cross-project dragging, reordering within the checked section, custom drag animations, integer-position renormalization (midpoint precision is ample at personal-list scale).

## Verification

1. Drag a middle to-do to the top → it stays after reload, and the home card + projects list show it as "what's next".
2. Drag with touch on a phone (or DevTools device emulation).
3. Add a new to-do → appears at top; check one off → sinks to bottom; both still work.
