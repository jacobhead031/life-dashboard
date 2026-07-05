"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Monthly goals ─────────────────────────────────────────────

export async function toggleGoal(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("monthly_goal").update({ done }).eq("id", id);
  revalidatePath("/");
  revalidatePath("/goals");
}

export async function addGoal(text: string, month: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("monthly_goal").insert({
    user_id: user.id,
    text,
    month,
    origin_month: month,
    done: false,
  });
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function carryOverGoals(fromMonth: string, toMonth: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const [{ data: incomplete }, { data: existing }] = await Promise.all([
    supabase
      .from("monthly_goal")
      .select("*")
      .eq("month", fromMonth)
      .eq("done", false)
      .eq("user_id", user.id),
    supabase
      .from("monthly_goal")
      .select("text")
      .eq("month", toMonth)
      .eq("user_id", user.id),
  ]);

  if (!incomplete?.length) return;

  const existingTexts = new Set((existing ?? []).map((g) => g.text));
  const toInsert = incomplete
    .filter((g) => !existingTexts.has(g.text))
    .map((g) => ({
      user_id: user.id,
      text: g.text,
      month: toMonth,
      origin_month: g.origin_month,
      done: false,
    }));

  if (toInsert.length > 0) {
    await supabase.from("monthly_goal").insert(toInsert);
  }

  revalidatePath("/goals");
  revalidatePath("/");
}

export async function deleteGoal(id: string) {
  const supabase = await createClient();
  await supabase.from("monthly_goal").delete().eq("id", id);
  revalidatePath("/goals");
  revalidatePath("/");
}

// ── Sunrise & sunset ──────────────────────────────────────────

export async function setSunriseSunset(
  month: string,
  sunriseDone: boolean,
  sunsetDone: boolean
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("sunrise_sunset").upsert(
    { user_id: user.id, month, sunrise_done: sunriseDone, sunset_done: sunsetDone },
    { onConflict: "user_id,month" }
  );
  revalidatePath("/");
}

// ── Books ─────────────────────────────────────────────────────

export async function updateBookPage(id: string, currentPage: number) {
  const supabase = await createClient();
  await supabase.from("book").update({ current_page: currentPage }).eq("id", id);
  revalidatePath("/");
  revalidatePath("/books");
}

export async function markBookFinished(id: string) {
  const supabase = await createClient();
  await supabase.from("book").update({
    status: "finished",
    date_finished: new Date().toISOString().split("T")[0],
    current_page: null,
  }).eq("id", id);
  revalidatePath("/");
  revalidatePath("/books");
}

export async function addBook(data: {
  title: string;
  author: string;
  status: "reading" | "finished" | "abandoned";
  total_pages?: number | null;
  current_page?: number | null;
  rating?: number | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("book").insert({ ...data, user_id: user.id });
  revalidatePath("/books");
  revalidatePath("/");
}

export async function updateBook(
  id: string,
  data: {
    title?: string;
    author?: string;
    status?: "reading" | "finished" | "abandoned";
    total_pages?: number | null;
    current_page?: number | null;
    rating?: number | null;
    notes?: string | null;
    date_finished?: string | null;
  }
) {
  const supabase = await createClient();
  await supabase.from("book").update(data).eq("id", id);
  revalidatePath("/books");
  revalidatePath("/");
}

export async function deleteBook(id: string) {
  const supabase = await createClient();
  await supabase.from("book").delete().eq("id", id);
  revalidatePath("/books");
  revalidatePath("/");
}

// ── Learning tracks ───────────────────────────────────────────

export async function addTrack(data: {
  name: string;
  total_steps: number;
  current_label: string;
  accent: "amber" | "sky";
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("learning_track").insert({
    ...data,
    user_id: user.id,
    completed_steps: 0,
  });
  revalidatePath("/learning");
  revalidatePath("/");
}

export async function updateTrack(
  id: string,
  data: {
    name?: string;
    total_steps?: number;
    completed_steps?: number;
    current_label?: string;
    accent?: "amber" | "sky";
  }
) {
  const supabase = await createClient();
  await supabase.from("learning_track").update(data).eq("id", id);
  revalidatePath("/learning");
  revalidatePath("/");
}

export async function setActiveTrack(activeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("learning_track")
    .update({ accent: "sky" })
    .eq("user_id", user.id);
  await supabase
    .from("learning_track")
    .update({ accent: "amber" })
    .eq("id", activeId);
  revalidatePath("/learning");
  revalidatePath("/");
}

export async function deleteTrack(id: string) {
  const supabase = await createClient();
  await supabase.from("learning_track").delete().eq("id", id);
  revalidatePath("/learning");
  revalidatePath("/");
}

// ── Ideas ─────────────────────────────────────────────────────

export async function addIdea(data: {
  tag: string;
  text: string;
  effort: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("idea")
    .insert({ ...data, user_id: user.id, archived: false });
  revalidatePath("/ideas");
  revalidatePath("/");
}

export async function archiveIdea(id: string, archived: boolean) {
  const supabase = await createClient();
  await supabase.from("idea").update({ archived }).eq("id", id);
  revalidatePath("/ideas");
  revalidatePath("/");
}

// ── Yearly targets ────────────────────────────────────────────

export async function addTarget(data: {
  name: string;
  kind: "count" | "best";
  goal: number;
  unit?: string | null;
  year: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("target")
    .insert({ ...data, user_id: user.id, current: 0 });
  revalidatePath("/targets");
  revalidatePath("/");
}

export async function updateTarget(
  id: string,
  current: number,
  goal: number
) {
  const supabase = await createClient();
  await supabase.from("target").update({ current, goal }).eq("id", id);
  revalidatePath("/targets");
  revalidatePath("/");
}

export async function deleteTarget(id: string) {
  const supabase = await createClient();
  await supabase.from("target").delete().eq("id", id);
  revalidatePath("/targets");
  revalidatePath("/");
}

// ── Birthdays ─────────────────────────────────────────────────

export async function addBirthday(data: {
  name: string;
  month: number;
  day: number;
  relationship?: string | null;
  lead_days: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("recurring_date").insert({ ...data, user_id: user.id });
  revalidatePath("/birthdays");
  revalidatePath("/");
}

export async function updateBirthday(
  id: string,
  data: {
    name?: string;
    month?: number;
    day?: number;
    relationship?: string | null;
    lead_days?: number;
  }
) {
  const supabase = await createClient();
  await supabase.from("recurring_date").update(data).eq("id", id);
  revalidatePath("/birthdays");
  revalidatePath("/");
}

export async function deleteBirthday(id: string) {
  const supabase = await createClient();
  await supabase.from("recurring_date").delete().eq("id", id);
  revalidatePath("/birthdays");
  revalidatePath("/");
}

// ── Reflections ───────────────────────────────────────────────

export async function addReflection(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("reflection").insert({ user_id: user.id, name });
  revalidatePath("/reflection");
  revalidatePath("/");
}

export async function addReflectionNote(
  reflectionId: string,
  text: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("reflection_note").insert({
    user_id: user.id,
    reflection_id: reflectionId,
    text,
  });
  revalidatePath("/reflection");
  revalidatePath("/");
}

export async function deleteReflectionNote(id: string) {
  const supabase = await createClient();
  await supabase.from("reflection_note").delete().eq("id", id);
  revalidatePath("/reflection");
  revalidatePath("/");
}

export async function deleteReflection(id: string) {
  const supabase = await createClient();
  await supabase.from("reflection_note").delete().eq("reflection_id", id);
  await supabase.from("reflection").delete().eq("id", id);
  revalidatePath("/reflection");
  revalidatePath("/");
}

// ── Habits ────────────────────────────────────────────────────

export async function addHabit(name: string, color: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("habit").insert({ user_id: user.id, name, color });
  revalidatePath("/habits");
  revalidatePath("/");
}

export async function deleteHabit(id: string) {
  const supabase = await createClient();
  await supabase.from("habit").delete().eq("id", id);
  revalidatePath("/habits");
  revalidatePath("/");
}

export async function toggleHabitLog(habitId: string, date: string, isDone: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (isDone) {
    await supabase.from("habit_log").upsert({ user_id: user.id, habit_id: habitId, date });
  } else {
    await supabase.from("habit_log").delete().eq("habit_id", habitId).eq("date", date);
  }
  revalidatePath("/");
  revalidatePath("/habits");
}
