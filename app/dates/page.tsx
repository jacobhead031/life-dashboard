import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { isGuest, todayStr } from "@/lib/utils";
import type { DateIdea, DateMedia, DateScore } from "@/lib/types";
import { DatesContent } from "./DatesContent";

export default async function DatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: ideas }, { data: scores }, { data: media }] = await Promise.all([
    supabase.from("date_idea").select("*").order("position"),
    supabase.from("date_score").select("*"),
    supabase.from("date_media").select("*").order("created_at"),
  ]);

  // Private bucket: signed per render, good for a day (tabs get left open).
  const paths = ((media ?? []) as DateMedia[]).map((m) => m.path);
  const { data: signed } = paths.length ? await supabase.storage.from("date-photos").createSignedUrls(paths, 86400) : { data: null };
  const urlFor = (path: string) => signed?.find((s) => s.path === path)?.signedUrl || undefined;

  return (
    <div className="wrap">
      <div className="top">
        <Greeting name={isGuest(user.email) ? "you two" : "Jacob"} />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="dates" guest={isGuest(user.email)} />
      <DatesContent
        ideas={(ideas ?? []) as DateIdea[]}
        scores={(scores ?? []) as DateScore[]}
        media={((media ?? []) as DateMedia[]).map((m) => ({ ...m, url: urlFor(m.path) }))}
        userId={user.id}
        todayStr={todayStr()}
      />
    </div>
  );
}
