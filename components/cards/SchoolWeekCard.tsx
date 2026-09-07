import Link from "next/link";
import type { SchoolItem } from "@/lib/types";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export type SchoolItemWithClass = SchoolItem & { school_class: { name: string } | null };

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split("T")[0];
}

export function SchoolWeekCard({
  items,
  weekStr,
  todayStr,
}: {
  items: SchoolItemWithClass[];
  weekStr: string;
  todayStr: string;
}) {
  const weekEnd = addDays(weekStr, 6);
  const thisWeek = items.filter((i) => i.due_on >= weekStr && i.due_on <= weekEnd);

  return (
    <section className="card span-6" style={{ animationDelay: ".1s" }}>
      <div className="card-label">
        <span>school · this week</span>
        <Link href="/school" className="card-nav">view →</Link>
      </div>
      {thisWeek.length === 0 ? (
        <div className="empty-state">
          <p>Nothing due this week.</p>
          <Link href="/school" className="empty-link">→ add an assignment or exam</Link>
        </div>
      ) : (
        <div className="school-week">
          {DOW.map((d, i) => {
            const key = addDays(weekStr, i);
            return (
              <div key={d}>
                <div className={`school-day${key === todayStr ? " today" : ""}`}>
                  {d} {Number(key.slice(8))}
                </div>
                {thisWeek.filter((it) => it.due_on === key).map((it) => (
                  <div key={it.id} className={`cal-chip${it.kind === "exam" ? " exam" : ""}${it.done ? " done" : ""}`}>
                    <span>{it.title}</span>
                    <span className="cal-meta">{it.school_class?.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
