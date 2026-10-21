import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { addDays, todayStr } from "@/lib/utils";
import { StatsContent } from "./StatsContent";

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayStr();
  const [{ data: health }, { data: activities }, { data: profile }] = await Promise.all([
    supabase.from("health_day").select("*").gte("date", addDays(today, -90)).lte("date", today).order("date"),
    supabase.from("tri_activity").select("*").gte("date", addDays(today, -84)).order("date"),
    supabase.from("tri_profile").select("ftp_watts,css_s_100m,thr_run_s_km,weight_kg").maybeSingle(),
  ]);

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="coach" />
      <StatsContent today={today} health={health ?? []} activities={activities ?? []} profile={profile ?? null} />
    </div>
  );
}
