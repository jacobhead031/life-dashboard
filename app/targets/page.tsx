import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { todayStr } from "@/lib/utils";
import { TargetsContent } from "./TargetsContent";

export default async function TargetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: targets } = await supabase
    .from("target")
    .select("*")
    .order("year", { ascending: false })
    .order("updated_at", { ascending: false });

  const currentYear = Number(todayStr().slice(0, 4));

  return (
    <div className="wrap">
      <div className="detail-header">
        <Link href="/" className="back-link">← home</Link>
        <h1 className="detail-title">Yearly targets</h1>
      </div>
      <TargetsContent targets={targets ?? []} currentYear={currentYear} />
    </div>
  );
}
