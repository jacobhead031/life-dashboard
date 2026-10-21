import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { todayStr, weekMonday } from "@/lib/utils";
import type { CareerApp, CareerContact, CareerTodo, CareerWin } from "@/lib/types";
import { CareerContent } from "./CareerContent";

export default async function CareerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayStr();
  const week = weekMonday(today);
  const [{ data: todos }, { data: apps }, { data: contacts }, { data: wins }, { data: settings }] = await Promise.all([
    supabase.from("career_todo").select("*").gte("week", week).order("position"),
    supabase.from("career_app").select("*").order("updated_at", { ascending: false }),
    supabase.from("career_contact").select("*").order("created_at", { ascending: false }),
    supabase.from("career_win").select("*").order("happened_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("user_settings").select("sales_exp_since").maybeSingle(),
  ]);

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="career" />
      <CareerContent
        todos={(todos ?? []) as CareerTodo[]}
        apps={(apps ?? []) as CareerApp[]}
        contacts={(contacts ?? []) as CareerContact[]}
        wins={(wins ?? []) as CareerWin[]}
        salesExpSince={settings?.sales_exp_since ?? null}
        todayStr={today}
        weekStr={week}
      />
    </div>
  );
}
