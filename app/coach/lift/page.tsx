import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { addDays, todayStr } from "@/lib/utils";
import { LiftContent } from "./LiftContent";

// /coach/lift?date=YYYY-MM-DD — defaults to today. Shows that day's strength
// session (or the next one) with last time's weights pre-filled.
export default async function LiftPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { date: qs } = await searchParams;
  const today = todayStr();
  const date = qs && /^\d{4}-\d{2}-\d{2}$/.test(qs) ? qs : today;
  const [{ data: sessions }, { data: history }] = await Promise.all([
    supabase.from("tri_session").select("*").eq("sport", "strength").gte("date", addDays(date, -14)).lte("date", addDays(date, 14)).order("date"),
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
      <LiftContent date={date} today={today} sessions={sessions ?? []} history={history ?? []} />
    </div>
  );
}
