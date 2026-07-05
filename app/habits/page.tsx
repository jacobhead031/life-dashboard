import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HabitsContent } from "./HabitsContent";

export default async function HabitsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  // fetch logs for current month + a few days back (for streak context)
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const sixtyAgo = new Date(now);
  sixtyAgo.setUTCDate(sixtyAgo.getUTCDate() - 60);
  const sixtyAgoStr = sixtyAgo.toISOString().split("T")[0];

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habit").select("*").order("created_at"),
    supabase.from("habit_log").select("*").gte("date", sixtyAgoStr).order("date"),
  ]);

  const todayStr = now.toISOString().split("T")[0];

  return (
    <div className="wrap">
      <div className="top" style={{ marginBottom: 24 }}>
        <a href="/" style={{ color: "var(--muted)", fontSize: "13px", textDecoration: "none" }}>
          ← dashboard
        </a>
      </div>
      <HabitsContent
        habits={habits ?? []}
        logs={logs ?? []}
        todayStr={todayStr}
        currentYear={year}
        currentMonth={month}
      />
    </div>
  );
}
