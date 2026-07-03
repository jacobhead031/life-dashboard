"use client";

import { useState, useTransition, useEffect } from "react";
import {
  addBook,
  updateBook,
  deleteBook,
  updateBookPage,
  markBookFinished,
} from "@/app/actions";
import type { Book } from "@/lib/types";

type StatusFilter = "all" | "reading" | "finished" | "abandoned";

function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value || 0;
  return (
    <div className="star-row" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn${display >= n ? " on" : ""}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n === value ? 0 : n)}
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function NotesEditor({
  bookId,
  initial,
}: {
  bookId: string;
  initial: string | null;
}) {
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setText(initial ?? "");
    setSaved(true);
  }, [initial]);

  async function save() {
    await updateBook(bookId, { notes: text || null });
    setSaved(true);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <textarea
        className="note-input"
        style={{ width: "100%", minHeight: 72 }}
        value={text}
        placeholder="Notes about this book…"
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
      />
      {!saved && (
        <button className="d-btn" style={{ marginTop: 6 }} onClick={save}>
          save
        </button>
      )}
    </div>
  );
}

export function BooksContent({ books }: { books: Book[] }) {
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Add form state
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<"reading" | "finished" | "abandoned">(
    "reading"
  );
  const [totalPages, setTotalPages] = useState("");
  const [adding, setAdding] = useState(false);

  const counts = {
    all: books.length,
    reading: books.filter((b) => b.status === "reading").length,
    finished: books.filter((b) => b.status === "finished").length,
    abandoned: books.filter((b) => b.status === "abandoned").length,
  };

  const filtered =
    filter === "all" ? books : books.filter((b) => b.status === filter);

  function toggleNotes(id: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (!title.trim() || !author.trim()) return;
    setAdding(true);
    setShowAdd(false);
    setTitle("");
    setAuthor("");
    setStatus("reading");
    setTotalPages("");
    await addBook({
      title: title.trim(),
      author: author.trim(),
      status,
      total_pages: totalPages ? parseInt(totalPages) : null,
    });
    setAdding(false);
  }

  function handleRate(book: Book, n: number) {
    startTransition(async () => {
      await updateBook(book.id, { rating: n || null });
    });
  }

  function handleFinish(book: Book) {
    startTransition(async () => {
      await markBookFinished(book.id);
    });
  }

  async function handleDelete(book: Book) {
    if (!confirm(`Delete "${book.title}"?`)) return;
    await deleteBook(book.id);
  }

  async function handleStatusChange(
    book: Book,
    s: "reading" | "finished" | "abandoned"
  ) {
    await updateBook(book.id, { status: s });
  }

  return (
    <div>
      {/* Top row */}
      <div className="detail-top-row">
        <div className="d-tabs">
          {(
            ["all", "reading", "finished", "abandoned"] as StatusFilter[]
          ).map((f) => (
            <button
              key={f}
              className={`d-tab${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
              {counts[f] > 0 && (
                <span style={{ opacity: 0.45, marginLeft: 4 }}>
                  ({counts[f]})
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          className="btn primary"
          onClick={() => setShowAdd((v) => !v)}
          disabled={adding}
        >
          {showAdd ? "✕ cancel" : "+ add book"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="add-panel">
          <div className="add-panel-title">new book</div>
          <div className="d-form-row">
            <div className="d-field" style={{ flex: 2 }}>
              <label>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book title"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="d-field" style={{ flex: 2 }}>
              <label>Author</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
          </div>
          <div className="d-form-row">
            <div className="d-field">
              <label>Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as "reading" | "finished" | "abandoned"
                  )
                }
              >
                <option value="reading">Reading</option>
                <option value="finished">Finished</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
            <div className="d-field">
              <label>Total pages</label>
              <input
                type="number"
                value={totalPages}
                onChange={(e) => setTotalPages(e.target.value)}
                placeholder="e.g. 320"
                min={1}
              />
            </div>
          </div>
          <div className="d-form-actions">
            <button
              className="btn primary"
              onClick={handleAdd}
              disabled={!title.trim() || !author.trim()}
            >
              Add book
            </button>
            <button className="btn" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Book list */}
      {filtered.length === 0 ? (
        <div className="card-full" style={{ padding: "22px" }}>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            {filter === "all"
              ? "No books yet — add one above."
              : `No ${filter} books.`}
          </p>
        </div>
      ) : (
        <div className="card-full">
          {filtered.map((book) => {
            const pct =
              book.total_pages && book.current_page
                ? Math.round((book.current_page / book.total_pages) * 100)
                : 0;
            const notesOpen = expandedNotes.has(book.id);

            return (
              <div key={book.id} className="d-item">
                {book.status === "reading" && (
                  <div
                    className="cover"
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                )}

                <div className="d-item-main">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="d-item-title">{book.title}</span>
                    <span className={`status-badge status-${book.status}`}>
                      {book.status}
                    </span>
                  </div>
                  <div className="d-item-meta">{book.author}</div>

                  {/* Reading: progress */}
                  {book.status === "reading" && book.total_pages && (
                    <div style={{ marginTop: 8 }}>
                      <div className="bar" style={{ marginBottom: 4 }}>
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <span className="r-prog">
                        p. {book.current_page ?? 0} / {book.total_pages}
                      </span>
                    </div>
                  )}

                  {/* Finished: stars + date */}
                  {book.status === "finished" && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <StarRating
                        value={book.rating}
                        onChange={(n) => handleRate(book, n)}
                      />
                      {book.date_finished && (
                        <span className="d-item-meta" style={{ marginTop: 0 }}>
                          finished{" "}
                          {new Date(book.date_finished).toLocaleDateString(
                            "en-US",
                            { month: "short", year: "numeric" }
                          )}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action row */}
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <button
                      className="d-btn"
                      onClick={() => toggleNotes(book.id)}
                    >
                      notes {notesOpen ? "▴" : "▾"}
                    </button>
                    {book.status === "reading" && (
                      <button
                        className="d-btn success"
                        onClick={() => handleFinish(book)}
                      >
                        ✓ mark finished
                      </button>
                    )}
                  </div>

                  {notesOpen && (
                    <NotesEditor bookId={book.id} initial={book.notes} />
                  )}
                </div>

                {/* Right: status change + delete */}
                <div className="d-item-actions">
                  <select
                    className="d-btn"
                    style={{
                      padding: "5px 24px 5px 8px",
                      cursor: "pointer",
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235C616E'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 6px center",
                      backgroundColor: "transparent",
                      WebkitAppearance: "none",
                    }}
                    value={book.status}
                    onChange={(e) =>
                      handleStatusChange(
                        book,
                        e.target.value as
                          | "reading"
                          | "finished"
                          | "abandoned"
                      )
                    }
                  >
                    <option value="reading">reading</option>
                    <option value="finished">finished</option>
                    <option value="abandoned">abandoned</option>
                  </select>
                  <button
                    className="d-btn danger"
                    onClick={() => handleDelete(book)}
                    aria-label="Delete book"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
