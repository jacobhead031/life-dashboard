import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { HealthContent } from "./HealthContent";

export default async function HealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const twentyEightAgo = new Date(now);
  twentyEightAgo.setUTCDate(twentyEightAgo.getUTCDate() - 28);
  const twentyEightAgoStr = twentyEightAgo.toISOString().split("T")[0];

  const [{ data: days }, { data: weighIns }, { data: recs }] = await Promise.all([
    supabase.from("health_day").select("*").gte("date", twentyEightAgoStr).order("date"),
    supabase
      .from("health_day")
      .select("date, weight")
      .not("weight", "is", null)
      .order("date", { ascending: false })
      .limit(12),
    supabase
      .from("health_recs")
      .select("*")
      .order("week_of", { ascending: false })
      .limit(1),
  ]);

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="health" />
      <HealthContent
        days={days ?? []}
        weighIns={(weighIns ?? []).reverse()}
        latestRecs={recs?.[0] ?? null}
      />
    </div>
  );
}
