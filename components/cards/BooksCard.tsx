"use client";

import Link from "next/link";
import { useOptimistic, useTransition, useState, useRef } from "react";
import { updateBookPage, markBookFinished } from "@/app/actions";
import type { Book } from "@/lib/types";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

export function BooksCard({
  books: initialBooks,
  finishedThisYear,
}: {
  books: Book[];
  finishedThisYear: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [books, applyOptimistic] = useOptimistic(
    initialBooks,
    (state: Book[], patch: Partial<Book> & { id: string }) =>
      state.map((b) => (b.id === patch.id ? { ...b, ...patch } : b))
  );

  // Which book's page count is being edited inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing(book: Book) {
    setEditingId(book.id);
    setEditValue(String(book.current_page ?? ""));
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit(book: Book) {
    const n = parseInt(editValue, 10);
    setEditingId(null);
    if (isNaN(n) || n === book.current_page) return;
    const clamped = Math.max(0, book.total_pages ? Math.min(n, book.total_pages) : n);
    startTransition(async () => {
      applyOptimistic({ id: book.id, current_page: clamped });
      await updateBookPage(book.id, clamped);
    });
  }

  function handleFinish(book: Book) {
    startTransition(async () => {
      const today = new Date().toISOString().split("T")[0];
      applyOptimistic({ id: book.id, status: "finished", date_finished: today, current_page: null });
      await markBookFinished(book.id);
    });
  }

  const reading  = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished").slice(0, 4);

  return (
    <section className="card span-3" style={{ animationDelay: ".10s" }}>
      <div className="card-label">
        <span>books · {finishedThisYear} read this year</span>
        <Link href="/books" className="card-nav">shelf →</Link>
      </div>

      {books.length === 0 ? (
        <div className="empty-state">
          <p>Nothing on the shelf yet. Add your first book.</p>
          <Link href="/books" className="empty-link">→ open shelf</Link>
        </div>
      ) : (
        <>
          {reading.length > 0 ? (
            <>
              <div className="now-label">reading now</div>
              {reading.map((book) => {
                const progress =
                  book.total_pages && book.current_page
                    ? Math.round((book.current_page / book.total_pages) * 100)
                    : 0;
                const isEditing = editingId === book.id;

                return (
                  <div key={book.id} className="reading">
                    <div className="cover" />
                    <div style={{ flex: 1 }}>
                      <div className="r-title">{book.title}</div>
                      <div className="r-author">{book.author}</div>

                      {book.total_pages ? (
                        <>
                          <div className="bar">
                            <i style={{ width: `${progress}%` }} />
                          </div>
                          <div className="book-progress-row">
                            <span className="r-prog">
                              {"p. "}
                              {isEditing ? (
                                <input
                                  ref={inputRef}
                                  className="page-input"
                                  type="number"
                                  value={editValue}
                                  min={0}
                                  max={book.total_pages ?? undefined}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => commitEdit(book)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitEdit(book);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  style={{ width: `${Math.max(editValue.length, 2) + 1}ch` }}
                                />
                              ) : (
                                <button
                                  className="page-btn"
                                  onClick={() => startEditing(book)}
                                  title="Click to update page"
                                  aria-label="Edit current page"
                                >
                                  {book.current_page ?? 0}
                                </button>
                              )}
                              {" / "}{book.total_pages}
                            </span>
                            <button
                              className="mark-done-btn"
                              onClick={() => !isPending && handleFinish(book)}
                              disabled={isPending}
                            >
                              ✓ done
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="book-progress-row" style={{ marginTop: 8 }}>
                          <button
                            className="mark-done-btn"
                            onClick={() => !isPending && handleFinish(book)}
                            disabled={isPending}
                          >
                            ✓ mark finished
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div className="now-label" style={{ color: "var(--muted-2)" }}>
                nothing in progress
              </div>
              <Link href="/books" className="empty-link" style={{ marginTop: 6, display: "inline-block" }}>
                → open shelf &amp; add a book
              </Link>
            </div>
          )}

          {finished.length > 0 && (
            <div className="finished">
              <div className="f-label">finished</div>
              {finished.map((book) => (
                <div key={book.id} className="ftitle">
                  <span className="check">✓</span>
                  {book.title}
                  {book.rating != null && <Stars rating={book.rating} />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
