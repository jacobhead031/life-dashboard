import Link from "next/link";
import type { CareerTodo } from "@/lib/types";
import { currentGate } from "@/lib/career";

export function CareerWeekCard({ todos, todayStr }: { todos: CareerTodo[]; todayStr: string }) {
  const done = todos.filter((t) => t.done).length;
  const gate = currentGate(todayStr);
  return (
    <section className="card span-6" style={{ animationDelay: ".12s" }}>
      <div className="card-label">
        <span>career · this week</span>
        <Link href="/career" className="card-nav">{todos.length ? `${done}/${todos.length} · ` : ""}view →</Link>
      </div>
      {todos.length === 0 ? (
        <div className="empty-state">
          <p>No priorities set this week.</p>
          <Link href="/career" className="empty-link">→ open the career tab</Link>
        </div>
      ) : (
        <div>
          {todos.slice(0, 5).map((t) => (
            <div key={t.id} className={`note-stream-item${t.done ? " done" : ""}`}>
              <span className="todo-check" style={{ color: t.done ? "var(--green)" : "var(--muted-2)" }}>{t.done ? "✓" : "○"}</span>
              <div className="note-stream-body">{t.text}</div>
            </div>
          ))}
        </div>
      )}
      <p className="career-gate-line">{gate.name} · gate: {gate.gate}</p>
    </section>
  );
}
