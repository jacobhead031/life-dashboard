import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { addDays, daysBetween, getUpcomingBirthday, todayStr, weekMonday } from "@/lib/utils";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";
import { BirthdayBanner } from "@/components/BirthdayBanner";
import { SchoolBanner } from "@/components/SchoolBanner";
import { SchoolWeekCard, type SchoolItemWithClass } from "@/components/cards/SchoolWeekCard";
import { ActiveProjectsCard } from "@/components/cards/ActiveProjectsCard";
import { MonthlyGoalsCard } from "@/components/cards/MonthlyGoalsCard";
import { BooksCard } from "@/components/cards/BooksCard";
import { LearningCard } from "@/components/cards/LearningCard";
import { TargetsCard } from "@/components/cards/TargetsCard";
import { SunriseSunsetCard } from "@/components/cards/SunriseSunsetCard";
import { ReflectionCard } from "@/components/cards/ReflectionCard";
import { BirthdaysCard } from "@/components/cards/BirthdaysCard";
import { HabitsCard } from "@/components/cards/HabitsCard";
import { WeeklyGoalsCard } from "@/components/cards/WeeklyGoalsCard";
import { HealthCard } from "@/components/cards/HealthCard";
import { TabNav } from "@/components/TabNav";
import { HomeGrid } from "@/components/HomeGrid";

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

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayStr();
  const currentYear = Number(today.slice(0, 4));
  const currentMonthStr = today.slice(0, 7);

  const weekStr = weekMonday(today);
  const thirtyAgoStr = addDays(today, -30);
  const plus7Str = addDays(today, 7);

  // Fetch all data in parallel — RLS ensures we only get this user's rows
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
    { data: healthDays },
    { data: healthWeights },
    { data: schoolItems },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("monthly_goal")
      .select("*")
      .eq("month", currentMonthStr)
      .order("created_at"),
    supabase
      .from("projects")
      .select("*, notes(body)")
      .eq("status", "active")
      .eq("notes.done", false)
      .order("touched_at", { ascending: true })
      .order("position", { referencedTable: "notes", ascending: true })
      .limit(1, { referencedTable: "notes" }),
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
    fetchTorontoSunTimes(today),
    supabase.from("habit").select("*").order("created_at"),
    supabase.from("habit_log").select("*").gte("date", thirtyAgoStr).order("date"),
    supabase.from("weekly_goal").select("*").eq("week", weekStr).order("position").order("created_at"),
    supabase
      .from("health_day")
      .select("*")
      .not("recovery_pct", "is", null)
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("health_day")
      .select("date, weight")
      .not("weight", "is", null)
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("school_item")
      .select("*, school_class(name, color)")
      .gte("due_on", weekStr)
      .lte("due_on", plus7Str)
      .order("due_on"),
    supabase.from("user_settings").select("home_order").maybeSingle(),
  ]);

  // Derive finished-this-year count for books card label
  const finishedThisYear = (books ?? []).filter(
    (b) =>
      b.status === "finished" &&
      b.date_finished &&
      b.date_finished.startsWith(`${currentYear}-`)
  ).length;

  // Compute nearest upcoming birthday within its lead window
  const upcoming = getUpcomingBirthday(birthdays ?? [], today);

  // Nearest unfinished assignment/exam due today or within 7 days
  const school = (schoolItems ?? []) as SchoolItemWithClass[];
  const nextDue = school.find((i) => !i.done && i.due_on >= today);
  const dueIn = nextDue ? daysBetween(today, nextDue.due_on) : 0;

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
      {nextDue && (
        <SchoolBanner
          title={nextDue.title}
          kind={nextDue.kind}
          className={nextDue.school_class?.name ?? ""}
          dayName={new Date(nextDue.due_on + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}
          relLabel={dueIn === 0 ? "today" : dueIn === 1 ? "tomorrow" : `in ${dueIn} days`}
        />
      )}

      {/* ── Bento grid: default order below; the saved order (arrange mode) overrides it ── */}
      <HomeGrid
        order={settings?.home_order ?? []}
        slots={[
          { id: "habits", span: 6, href: "/habits", node: <HabitsCard habits={habits ?? []} logs={habitLogs ?? []} todayStr={today} /> },
          { id: "weekly-goals", span: 6, node: <WeeklyGoalsCard goals={weeklyGoals ?? []} weekStr={weekStr} /> },
          { id: "health", span: 6, href: "/health", node: <HealthCard latest={healthDays?.[0] ?? null} lastWeight={healthWeights?.[0] ?? null} /> },
          { id: "school", span: 6, href: "/school", node: <SchoolWeekCard items={school} weekStr={weekStr} todayStr={today} /> },
          { id: "monthly-goals", span: 2, href: "/goals", node: <MonthlyGoalsCard goals={goals ?? []} currentMonthStr={currentMonthStr} /> },
          { id: "projects", span: 4, href: "/notes", node: <ActiveProjectsCard projects={liveProjects ?? []} /> },
          { id: "books", span: 3, href: "/books", node: <BooksCard books={books ?? []} finishedThisYear={finishedThisYear} /> },
          { id: "learning", span: 3, href: "/learning", node: <LearningCard tracks={tracks ?? []} /> },
          { id: "targets", span: 3, href: "/targets", node: <TargetsCard targets={targets ?? []} currentYear={currentYear} /> },
          { id: "sun", span: 3, node: <SunriseSunsetCard times={sunTimes} ss={ss ?? null} currentMonthStr={currentMonthStr} /> },
          { id: "reflection", span: 6, href: "/reflection", node: <ReflectionCard reflections={reflections ?? []} notes={reflectionNotes ?? []} /> },
          { id: "birthdays", span: 6, href: "/birthdays", node: <BirthdaysCard birthdays={birthdays ?? []} /> },
        ]}
      />
    </div>
  );
}
