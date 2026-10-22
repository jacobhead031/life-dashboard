import Link from "next/link";
import type { CareerTodo } from "@/lib/types";
import { currentGate } from "@/lib/career";

export function CareerWeekCard({ todos, todayStr }: { todos: CareerTodo[]; todayStr: string }) {
  const done = todos.filter((t) => t.done).length;
  // One thing at a time: the first unticked priority, in list order.
  const open = [...todos].filter((t) => !t.done).sort((a, b) => a.position - b.position);
  const gate = currentGate(todayStr);
  return (
    <section className="card span-6" style={{ animationDelay: ".12s" }}>
      <div className="card-label">
        <span>career · this week</span>
        <Link href="/career" className="card-nav">{todos.length ? `${done}/${todos.length} · ` : ""}view →</Link>
      </div>
      {open.length === 0 ? (
        <div className="empty-state">
          <p>{todos.length ? "All done this week." : "No priorities set this week."}</p>
          <Link href="/career" className="empty-link">→ open the career tab</Link>
        </div>
      ) : (
        <div className="career-next">
          <div className="life-kicker" style={{ color: "var(--muted-2)" }}>next up</div>
          <p className="career-next-text">{open[0].text}</p>
          {open.length > 1 && <p className="career-next-more">then {open.length - 1} more · {done} done</p>}
        </div>
      )}
      <p className="career-gate-line">{gate.name} · gate: {gate.gate}</p>
    </section>
  );
}
