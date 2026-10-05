import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { hasUnsplash } from "@/lib/unsplash";
import { todayStr } from "@/lib/utils";
import type { LifeGoal } from "@/lib/types";
import { LifeContent } from "./LifeContent";

export default async function LifePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: goals }, { data: entries }] = await Promise.all([
    supabase.from("life_goal").select("*").order("position"),
    supabase.from("life_counter_entry").select("*").order("happened_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
  ]);

  // Private bucket: my photos are signed per render, good for a day (tabs get left open).
  const paths = ((goals ?? []) as LifeGoal[]).flatMap((g) => (g.photo_path ? [g.photo_path] : []));
  const { data: signed } = paths.length
    ? await supabase.storage.from("goal-photos").createSignedUrls(paths, 86400)
    : { data: null };

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="goals" />
      <LifeContent
        goals={((goals ?? []) as LifeGoal[]).map((g) => ({ ...g, photo_url: signed?.find((s) => s.path === g.photo_path)?.signedUrl || undefined }))}
        entries={entries ?? []}
        canFetchCovers={hasUnsplash()}
        todayStr={todayStr()}
      />
    </div>
  );
}
