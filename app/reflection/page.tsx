import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ReflectionContent } from "./ReflectionContent";

export default async function ReflectionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: reflections }, { data: notes }] = await Promise.all([
    supabase.from("reflection").select("*").order("created_at"),
    supabase
      .from("reflection_note")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="wrap">
      <div className="detail-header">
        <Link href="/" className="back-link">← home</Link>
        <h1 className="detail-title">Reflection</h1>
      </div>
      <ReflectionContent
        reflections={reflections ?? []}
        notes={notes ?? []}
      />
    </div>
  );
}
