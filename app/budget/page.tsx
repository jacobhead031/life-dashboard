import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { todayStr } from "@/lib/utils";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { BudgetContent } from "./BudgetContent";

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // First day of the month 11 months ago — 12 months of data total
  const [y, m] = todayStr().split("-").map(Number);
  const startStr = new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 10);

  const [{ data: expenses }, { data: categories }, { data: settings }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .gte("spent_on", startStr)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("budget_categories").select("*").order("name"),
    supabase.from("budget_settings").select("*").limit(1),
  ]);

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="budget" />
      <BudgetContent
        expenses={expenses ?? []}
        categories={categories ?? []}
        allowance={settings?.[0]?.allowance ?? 0}
      />
    </div>
  );
}
