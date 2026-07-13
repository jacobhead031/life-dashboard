import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SortFlow } from "./SortFlow";

export default async function SortPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: inbox }, { data: projects }] = await Promise.all([
    supabase.from("notes").select("*").is("project_id", null).order("created_at", { ascending: true }),
    supabase.from("projects").select("id, title, area, status").not("status", "eq", "done").order("title"),
  ]);

  if (!inbox?.length) redirect("/notes");

  return (
    <div className="wrap">
      <div className="top" style={{ marginBottom: 24 }}>
        <Link href="/notes" className="back-link">← notes</Link>
      </div>
      <SortFlow inbox={inbox} projects={projects ?? []} />
    </div>
  );
}
