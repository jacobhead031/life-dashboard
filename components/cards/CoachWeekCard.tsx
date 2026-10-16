import Link from "next/link";
import type { TriSession } from "@/lib/types";
import { addDays } from "@/lib/utils";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_COLOR: Record<TriSession["status"], string> = {
  planned: "var(--muted-2)", adjusted: "var(--amber)", done: "var(--green)",
  partial: "var(--amber)", skipped: "var(--coral)", moved: "var(--muted-2)",
};
const SPORT_ICON: Record<string, string> = {
  swim: "🏊", bike: "🚴", run: "🏃", brick: "🚴🏃", strength: "🏋️", hockey: "🏒", mobility: "🧘", test: "⏱", race: "🏁", rest: "😴",
};

export function CoachWeekCard({ sessions, weekStr, todayStr }: { sessions: TriSession[]; weekStr: string; todayStr: string }) {
  const todays = sessions.filter((s) => s.date === todayStr && s.sport !== "hockey");
  return (
    <section className="card span-6" style={{ animationDelay: ".12s" }}>
      <div className="card-label">
        <span>coach · {todays.length ? todays.map((s) => s.title).join(" + ") : "nothing planned today"}</span>
        <Link href="/coach" className="card-nav">view →</Link>
      </div>
      {sessions.length === 0 ? (
        <div className="empty-state">
          <p>No sessions this week yet. The builder runs Sunday at 6 pm.</p>
          <Link href="/coach" className="empty-link">→ open the coach</Link>
        </div>
      ) : (
        <div className="school-week">
          {DOW.map((d, i) => {
            const key = addDays(weekStr, i);
            return (
              <div key={d}>
                <div className={`school-day${key === todayStr ? " today" : ""}`}>{d} {Number(key.slice(8))}</div>
                {sessions.filter((s) => s.date === key).map((s) => (
                  <div
                    key={s.id}
                    className={`cal-chip${s.status === "skipped" ? " done" : ""}`}
                    style={{ "--chip": STATUS_COLOR[s.status] } as React.CSSProperties}
                  >
                    <span>{SPORT_ICON[s.sport] ?? "•"} {s.title}</span>
                    <span className="cal-meta">{s.duration_min ? `${s.duration_min}m` : ""}{s.status !== "planned" ? ` · ${s.status}` : ""}</span>
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
