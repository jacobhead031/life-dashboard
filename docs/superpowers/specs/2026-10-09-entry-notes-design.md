# Notes on count-goal entries

## Why

Count goals ("Read 100 books", "Master 10 dishes", "Play 12 songs on guitar") already keep a list: add an item by name, the count goes up, click the item to open its photo and video album. Nothing on an item can hold writing, so a dish has no recipe and a book has no review.

## What

Every entry (`life_counter_entry`) gets a free-text `notes` field, shown and edited inside the album dialog that already opens when the entry is clicked.

- **Where it appears:** under the photo grid in the entry's album, a textarea labelled with a generic placeholder: "The recipe, the review, how it went…". Counter entries (countries, concerts) get the same field; it costs nothing and a trip can have a story too.
- **Saving:** on blur, only when the text changed, through `startTransition` so errors reach `app/error.tsx`. Same pattern as the "where would they go?" textareas on People goals. Optimistic: the textarea keeps what was typed; the server write follows.
- **In the list:** `EntryRow` shows the first line of the note (truncated by CSS) where it currently shows "add photos & video →" / "3 in album →". With no note it keeps the album hint.
- Goal albums (`life_media.goal_id`) are unchanged; this is entries only.

## How

- **Migration** `013_entry_notes.sql`: `alter table life_counter_entry add column notes text;` Nullable, no default.
- **Type:** `LifeCounterEntry.notes: string | null` in `lib/types.ts`.
- **Action:** `saveEntryNotes(id, notes)` in `app/actions.ts`, max 20 000 chars via the existing `str` validator, then `revalidateLife()`.
- **UI:** `Album` in `app/life/LifeContent.tsx` takes an optional `notes` + `saveNotes` pair (passed only for entries) and renders the textarea after the grid. `EntryRow` reads `entry.notes`.
- **CSS:** one rule for the one-line preview (`.life-entry-note`, ellipsis) and the textarea height.
- **Docs:** add `notes text` to the `life_counter_entry` line in `CLAUDE.md`.

## Check

Build passes. Manual: open "Master 10 dishes", add a dish, open it, type a recipe, close, reopen, text is there and the row shows its first line. Edit it, reload, edit persists. Delete the entry, no orphan.

## Out of scope

- Rich text or markdown. Plain textarea preserves line breaks, which is what a recipe needs.
- Reading finished books from `/books` into the 100-books goal. Possible follow-up.
- A standalone page per entry.
