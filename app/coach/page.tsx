import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { intervalsConfigured } from "@/lib/intervals";
import { addDays, todayStr, weekMonday } from "@/lib/utils";
import { CoachContent } from "./CoachContent";

export default async function CoachPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayStr();
  const monday = weekMonday(today);
  const [{ data: profile }, { data: phases }, { data: week }, { data: tests }, { data: health }, { data: checkins }, { data: gear }] =
    await Promise.all([
      supabase.from("tri_profile").select("*").maybeSingle(),
      supabase.from("tri_phase").select("*").order("start_on"),
      supabase.from("tri_session").select("*").gte("date", monday).lte("date", addDays(monday, 6)).order("date").order("slot"),
      supabase.from("tri_session").select("*").in("sport", ["test", "race"]).order("date"),
      supabase.from("health_day").select("*").gte("date", addDays(today, -28)).lte("date", today).order("date"),
      supabase.from("tri_checkin").select("*").order("created_at", { ascending: false }).limit(7),
      supabase.from("tri_gear").select("*").order("rank", { nullsFirst: false }),
    ]);

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="coach" />
      <CoachContent
        today={today}
        profile={profile ?? null}
        phases={phases ?? []}
        week={week ?? []}
        tests={tests ?? []}
        health={health ?? []}
        checkins={checkins ?? []}
        gear={gear ?? []}
        syncOn={intervalsConfigured()}
      />
    </div>
  );
}
