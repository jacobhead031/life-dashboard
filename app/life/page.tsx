import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { hasUnsplash } from "@/lib/unsplash";
import { todayStr } from "@/lib/utils";
import type { LifeGoal, LifeMedia } from "@/lib/types";
import { LifeContent } from "./LifeContent";

export default async function LifePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: goals }, { data: entries }, { data: media }] = await Promise.all([
    supabase.from("life_goal").select("*").order("position"),
    supabase.from("life_counter_entry").select("*").order("happened_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("life_media").select("*").order("created_at"),
  ]);

  // Private bucket: my photos are signed per render, good for a day (tabs get left open).
  // ponytail: signs every album file on each render. Sign per album on open if the albums get large.
  const paths = [
    ...((goals ?? []) as LifeGoal[]).flatMap((g) => (g.photo_path ? [g.photo_path] : [])),
    ...((media ?? []) as LifeMedia[]).map((m) => m.path),
  ];
  const { data: signed } = paths.length
    ? await supabase.storage.from("goal-photos").createSignedUrls(paths, 86400)
    : { data: null };
  const urlFor = (path: string) => signed?.find((s) => s.path === path)?.signedUrl || undefined;

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="goals" />
      <LifeContent
        goals={((goals ?? []) as LifeGoal[]).map((g) => ({ ...g, photo_url: g.photo_path ? urlFor(g.photo_path) : undefined }))}
        media={((media ?? []) as LifeMedia[]).map((m) => ({ ...m, url: urlFor(m.path) }))}
        entries={entries ?? []}
        canFetchCovers={hasUnsplash()}
        todayStr={todayStr()}
      />
    </div>
  );
}
