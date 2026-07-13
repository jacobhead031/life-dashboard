import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUpcomingBirthday } from "@/lib/utils";

type SunTimes = {
  sunrise: string;
  sunset: string;
  dayLength: string;
  sunPct: number;
  isDaytime: boolean;
};

async function fetchTorontoSunTimes(date: string): Promise<SunTimes | null> {
  try {
    const res = await fetch(
      `https://api.sunrise-sunset.org/json?lat=43.6532&lng=-79.3832&date=${date}&formatted=0`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== "OK") return null;

    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString("en-US", {
        timeZone: "America/Toronto",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

    const sunriseMs = new Date(json.results.sunrise).getTime();
    const sunsetMs  = new Date(json.results.sunset).getTime();
    const nowMs     = Date.now();

    const diffMs   = sunsetMs - sunriseMs;
    const hours    = Math.floor(diffMs / 3_600_000);
    const mins     = Math.floor((diffMs % 3_600_000) / 60_000);
    const dayLength = `${hours}h ${mins}m`;

    const sunPct    = Math.max(0, Math.min(1, (nowMs - sunriseMs) / (sunsetMs - sunriseMs)));
    const isDaytime = nowMs >= sunriseMs && nowMs <= sunsetMs;

    return { sunrise: fmt(json.results.sunrise), sunset: fmt(json.results.sunset), dayLength, sunPct, isDaytime };
  } catch {
    return null;
  }
}

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
import { BirthdaysCard } from "@/components/cards/BirthdaysCard";
import { HabitsCard } from "@/components/cards/HabitsCard";
import { WeeklyGoalsCard } from "@/components/cards/WeeklyGoalsCard";
import { TabNav } from "@/components/TabNav";

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
  const todayStr = now.toISOString().split("T")[0];
  // Monday of current week
  const dow = now.getUTCDay();
  const weekMonday = new Date(now);
  weekMonday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  const weekStr = weekMonday.toISOString().split("T")[0];

  const thirtyAgo = new Date(now);
  thirtyAgo.setUTCDate(thirtyAgo.getUTCDate() - 30);
  const thirtyAgoStr = thirtyAgo.toISOString().split("T")[0];

  const [
    { data: goals },
    { data: liveProjects },
    { data: books },
    { data: tracks },
    { data: targets },
    { data: reflections },
    { data: reflectionNotes },
    { data: birthdays },
    { data: ss },
    sunTimes,
    { data: habits },
    { data: habitLogs },
    { data: weeklyGoals },
  ] = await Promise.all([
    supabase
      .from("monthly_goal")
      .select("*")
      .eq("month", currentMonthStr)
      .order("created_at"),
    supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("touched_at", { ascending: true }),
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
    supabase.from("reflection").select("*").order("updated_at"),
    supabase
      .from("reflection_note")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("recurring_date").select("*"),
    supabase.from("sunrise_sunset").select("*").eq("month", currentMonthStr).maybeSingle(),
    fetchTorontoSunTimes(todayStr),
    supabase.from("habit").select("*").order("created_at"),
    supabase.from("habit_log").select("*").gte("date", thirtyAgoStr).order("date"),
    supabase.from("weekly_goal").select("*").eq("week", weekStr).order("created_at"),
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

      <TabNav active="dashboard" />

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
        {/* Row 1 — habits (span 6) */}
        <HabitsCard habits={habits ?? []} logs={habitLogs ?? []} todayStr={todayStr} />

        {/* Row 2 — weekly goals (span 6) */}
        <WeeklyGoalsCard goals={weeklyGoals ?? []} weekStr={weekStr} />

        {/* Row 2 — monthly goals (span 2) + start something (span 4) */}
        <MonthlyGoalsCard
          goals={goals ?? []}
          currentMonthStr={currentMonthStr}
        />
        <StartSomethingCard projects={liveProjects ?? []} />

        {/* Row 3 — books (span 3) + learning (span 3) */}
        <BooksCard books={books ?? []} finishedThisYear={finishedThisYear} />
        <LearningCard tracks={tracks ?? []} />

        {/* Row 4 — targets (span 3) + sunrise/sunset (span 3) */}
        <TargetsCard targets={targets ?? []} currentYear={currentYear} />
        <SunriseSunsetCard times={sunTimes} ss={ss ?? null} currentMonthStr={currentMonthStr} />

        {/* Row 5 — reflection (span 6) */}
        <ReflectionCard
          reflections={reflections ?? []}
          notes={reflectionNotes ?? []}
        />

        {/* Row 6 — birthdays (span 6) */}
        <BirthdaysCard birthdays={birthdays ?? []} />
      </div>
    </div>
  );
}
