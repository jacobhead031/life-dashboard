import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { addDays, todayStr, weekMonday } from "@/lib/utils";
import { LiftContent } from "./LiftContent";

// /coach/lift?week=YYYY-MM-DD (a Monday) — every gym session of that week,
// each exercise with last time's weights pre-filled. Defaults to this week.
export default async function LiftPage({ searchParams }: { searchParams: Promise<{ week?: string; date?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { week: qs, date: qd } = await searchParams;
  const today = todayStr();
  const anchor = [qs, qd].find((v) => v && /^\d{4}-\d{2}-\d{2}$/.test(v)) ?? today;
  const monday = weekMonday(anchor);
  const [{ data: sessions }, { data: history }] = await Promise.all([
    supabase.from("tri_session").select("*").eq("sport", "strength").gte("date", monday).lte("date", addDays(monday, 6)).order("date"),
    supabase.from("tri_lift_log").select("*").gte("date", addDays(today, -120)).order("date", { ascending: false }).order("set_no"),
  ]);

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="coach" />
      <LiftContent monday={monday} today={today} sessions={sessions ?? []} history={history ?? []} />
    </div>
  );
}
