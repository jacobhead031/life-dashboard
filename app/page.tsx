import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUpcomingBirthday } from "@/lib/utils";

import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { BirthdayBanner } from "@/components/BirthdayBanner";
import { StartSomethingCard } from "@/components/StartSomethingCard";
import { MonthlyGoalsCard } from "@/components/cards/MonthlyGoalsCard";
import { BooksCard } from "@/components/cards/BooksCard";
import { LearningCard } from "@/components/cards/LearningCard";
import { TargetsCard } from "@/components/cards/TargetsCard";
import { SunriseSunsetCard } from "@/components/cards/SunriseSunsetCard";
import { ReflectionCard } from "@/components/cards/ReflectionCard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Fetch all data in parallel — RLS ensures we only get this user's rows
  const [
    { data: goals },
    { data: ideas },
    { data: books },
    { data: tracks },
    { data: targets },
    { data: ss },
    { data: reflections },
    { data: reflectionNotes },
    { data: birthdays },
  ] = await Promise.all([
    supabase
      .from("monthly_goal")
      .select("*")
      .eq("month", currentMonthStr)
      .order("created_at"),
    supabase
      .from("idea")
      .select("*")
      .eq("archived", false)
      .order("updated_at", { ascending: false }),
    supabase
      .from("book")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("learning_track")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("target")
      .select("*")
      .eq("year", currentYear)
      .order("updated_at", { ascending: false }),
    supabase
      .from("sunrise_sunset")
      .select("*")
      .eq("month", currentMonthStr)
      .maybeSingle(),
    supabase.from("reflection").select("*").order("updated_at"),
    supabase
      .from("reflection_note")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("recurring_date").select("*"),
  ]);

  // Derive finished-this-year count for books card label
  const finishedThisYear = (books ?? []).filter(
    (b) =>
      b.status === "finished" &&
      b.date_finished &&
      new Date(b.date_finished).getFullYear() === currentYear
  ).length;

  // Compute nearest upcoming birthday within its lead window
  const upcoming = getUpcomingBirthday(birthdays ?? [], now);

  return (
    <div className="wrap">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />

      {/* ── Birthday banner (conditional) ──────────────────── */}
      {upcoming && (
        <BirthdayBanner
          name={upcoming.birthday.name}
          dayName={upcoming.dayName}
          relLabel={upcoming.relLabel}
        />
      )}

      {/* ── Bento grid ─────────────────────────────────────── */}
      <div className="grid-bento">
        {/* Row 1 — monthly goals (span 2) + start something (span 4) */}
        <MonthlyGoalsCard
          goals={goals ?? []}
          currentMonthStr={currentMonthStr}
        />
        <StartSomethingCard ideas={ideas ?? []} />

        {/* Row 2 — books (span 3) + learning (span 3) */}
        <BooksCard books={books ?? []} finishedThisYear={finishedThisYear} />
        <LearningCard tracks={tracks ?? []} />

        {/* Row 3 — targets (span 3) + sunrise/sunset (span 3) */}
        <TargetsCard targets={targets ?? []} currentYear={currentYear} />
        <SunriseSunsetCard ss={ss ?? null} currentMonthStr={currentMonthStr} />

        {/* Row 4 — reflection (span 6) */}
        <ReflectionCard
          reflections={reflections ?? []}
          notes={reflectionNotes ?? []}
        />
      </div>
    </div>
  );
}
