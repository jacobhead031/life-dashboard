import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { addDays, todayStr } from "@/lib/utils";
import { HabitsContent } from "./HabitsContent";

export default async function HabitsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayStr();
  // 60 days back (for streak context)
  const sixtyAgoStr = addDays(today, -60);

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habit").select("*").order("created_at"),
    supabase.from("habit_log").select("*").gte("date", sixtyAgoStr).order("date"),
  ]);

  return (
    <div className="wrap">
      <div className="top" style={{ marginBottom: 24 }}>
        <Link href="/" className="back-link">← home</Link>
      </div>
      <HabitsContent
        habits={habits ?? []}
        logs={logs ?? []}
        todayStr={today}
        currentYear={Number(today.slice(0, 4))}
        currentMonth={Number(today.slice(5, 7))}
      />
    </div>
  );
}
