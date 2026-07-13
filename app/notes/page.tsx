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
      .in("status", ["active", "seed", "done"])
      .order("touched_at", { ascending: false }),
    supabase
      .from("notes")
      .select("*")
      .is("project_id", null)
      .order("created_at", { ascending: false }),
  ]);

  const active = (projects ?? []).filter((p) => p.status === "active");
  const seeds  = (projects ?? []).filter((p) => p.status === "seed");
  const done   = (projects ?? []).filter((p) => p.status === "done");

  return (
    <div className="wrap">
      <div className="top" style={{ marginBottom: 0 }}>
        <TabNav active="projects" />
      </div>
      <NotesView
        active={active}
        seeds={seeds}
        done={done}
        inbox={allInbox ?? []}
      />
    </div>
  );
}
