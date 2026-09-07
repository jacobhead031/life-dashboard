import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { SchoolContent } from "./SchoolContent";

export default async function SchoolPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: classes }, { data: items }] = await Promise.all([
    supabase.from("school_class").select("*").order("created_at"),
    supabase.from("school_item").select("*").order("due_on"),
  ]);

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="school" />
      <SchoolContent classes={classes ?? []} items={items ?? []} />
    </div>
  );
}
