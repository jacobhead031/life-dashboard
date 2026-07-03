import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LearningContent } from "./LearningContent";

export default async function LearningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tracks } = await supabase
    .from("learning_track")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="wrap">
      <div className="detail-header">
        <Link href="/" className="back-link">← home</Link>
        <h1 className="detail-title">Learning tracks</h1>
      </div>
      <LearningContent tracks={tracks ?? []} />
    </div>
  );
}
