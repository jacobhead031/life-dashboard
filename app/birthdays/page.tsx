import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BirthdaysContent } from "./BirthdaysContent";

export default async function BirthdaysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: birthdays } = await supabase
    .from("recurring_date")
    .select("*")
    .order("month")
    .order("day");

  return (
    <div className="wrap">
      <div className="detail-header">
        <Link href="/" className="back-link">← home</Link>
        <h1 className="detail-title">Birthdays</h1>
      </div>
      <BirthdaysContent birthdays={birthdays ?? []} />
    </div>
  );
}
