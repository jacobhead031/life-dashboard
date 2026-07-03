import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GoalsContent } from "./GoalsContent";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: goals } = await supabase
    .from("monthly_goal")
    .select("*")
    .order("month", { ascending: false })
    .order("created_at", { ascending: true });

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="wrap">
      <div className="detail-header">
        <Link href="/" className="back-link">← home</Link>
        <h1 className="detail-title">Monthly goals</h1>
      </div>
      <GoalsContent goals={goals ?? []} currentMonth={currentMonth} />
    </div>
  );
}
