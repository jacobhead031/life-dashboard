import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ProjectDetail } from "./ProjectDetail";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: project }, { data: notes }, { data: files }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("notes").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("project_files").select("*").eq("project_id", id).order("created_at", { ascending: false }),
  ]);

  if (!project) notFound();

  return (
    <div className="wrap">
      <div className="top" style={{ marginBottom: 24 }}>
        <Link href="/notes" className="back-link">← notes</Link>
      </div>
      <ProjectDetail
        project={project}
        notes={notes ?? []}
        files={files ?? []}
      />
    </div>
  );
}
