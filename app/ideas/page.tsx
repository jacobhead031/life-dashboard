import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IdeasContent } from "./IdeasContent";

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ideas } = await supabase
    .from("idea")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="wrap">
      <div className="detail-header">
        <Link href="/" className="back-link">← home</Link>
        <h1 className="detail-title">Idea bank</h1>
      </div>
      <IdeasContent ideas={ideas ?? []} />
    </div>
  );
}
