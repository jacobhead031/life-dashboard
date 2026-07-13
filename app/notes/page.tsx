import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotesView } from "./NotesView";
import { TabNav } from "@/components/TabNav";

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: projects }, { data: allInbox }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .in("status", ["active", "warm", "seed"])
      .order("touched_at", { ascending: false }),
    supabase
      .from("notes")
      .select("*")
      .is("project_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const active = (projects ?? []).filter((p) => p.status === "active");
  const warm   = (projects ?? []).filter((p) => p.status === "warm");
  const seeds  = (projects ?? []).filter((p) => p.status === "seed");

  return (
    <div className="wrap">
      <div className="top" style={{ marginBottom: 0 }}>
        <TabNav active="projects" />
      </div>
      <NotesView
        active={active}
        warm={warm}
        seeds={seeds}
        inbox={allInbox ?? []}
      />
    </div>
  );
}
