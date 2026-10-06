"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { HABIT_COLORS, todayStr } from "@/lib/utils";
import { LIFE_CATEGORIES, LIFE_COUNTERS } from "@/lib/life";
import { findCover } from "@/lib/unsplash";
import lifeSeed from "@/lib/life-goals.json";
import type { LifeGoal, LifeStep } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────

// Every Supabase call goes through ok(): a failed query throws instead of vanishing.
async function ok<T>(q: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

// RLS is the real guard; this makes a signed-out call fail loudly instead of no-op.
async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Required text: trimmed, non-empty, capped.
function str(v: string, label: string, max = 500) {
  const t = typeof v === "string" ? v.trim() : "";
  if (!t || t.length > max) throw new Error(`${label} must be 1-${max} characters`);
  return t;
}

// Required text on a partial update: skipped when absent, trimmed when present.
function optStr(v: string | undefined, label: string) {
  return v === undefined ? undefined : str(v, label);
}

// Optional text: only the cap applies.
function cap(v: string | null | undefined, label: string, max = 500) {
  if (v != null && (typeof v !== "string" || v.length > max)) throw new Error(`${label} is too long`);
  return v;
}

function num(v: number | null | undefined, label: string, min = -Infinity) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min) throw new Error(`${label} must be a valid number`);
  return v;
}

function pos(v: number, label: string) {
  if (num(v, label) <= 0) throw new Error(`${label} must be more than 0`);
  return v;
}

function fmt(v: string, re: RegExp, label: string) {
  if (typeof v !== "string" || !re.test(v)) throw new Error(`${label} is not valid`);
  return v;
}

// 2024 is a leap year, so Feb 29 passes. A lone day (month omitted) is checked against 31.
function birthday(month = 1, day = 1) {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Month must be 1-12");
  if (!Number.isInteger(day) || day < 1 || day > new Date(2024, month, 0).getDate()) throw new Error("Day isn't valid for that month");
}

// ── Home layout ───────────────────────────────────────────────

export async function saveHomeOrder(order: string[]) {
  const { supabase, user } = await authed();
  if (!Array.isArray(order) || order.length > 50 || !order.every((id) => typeof id === "string" && /^[a-z-]{1,30}$/.test(id))) {
    throw new Error("Invalid card order");
  }
  await ok(supabase.from("user_settings").upsert({ user_id: user.id, home_order: order }));
  revalidatePath("/");
}

// ── Monthly goals ─────────────────────────────────────────────

export async function toggleGoal(id: string, done: boolean) {
  const { supabase } = await authed();
  await ok(supabase.from("monthly_goal").update({ done }).eq("id", id));
  revalidatePath("/");
  revalidatePath("/goals");
}

export async function addGoal(text: string, month: string) {
  const { supabase, user } = await authed();
  fmt(month, MONTH, "Month");
  await ok(supabase.from("monthly_goal").insert({
    user_id: user.id,
    text: str(text, "Goal"),
    month,
    origin_month: month,
    done: false,
  }));
  revalidatePath("/goals");
  revalidatePath("/");
}

export async function carryOverGoals(fromMonth: string, toMonth: string) {
  const { supabase, user } = await authed();
  fmt(fromMonth, MONTH, "Month");
  fmt(toMonth, MONTH, "Month");

  const [incomplete, existing] = await Promise.all([
    ok(supabase
      .from("monthly_goal")
      .select("*")
      .eq("month", fromMonth)
      .eq("done", false)
      .eq("user_id", user.id)),
    ok(supabase
      .from("monthly_goal")
      .select("text")
      .eq("month", toMonth)
      .eq("user_id", user.id)),
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
    await ok(supabase.from("monthly_goal").insert(toInsert));
  }

  revalidatePath("/goals");
  revalidatePath("/");
}

export async function deleteGoal(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("monthly_goal").delete().eq("id", id));
  revalidatePath("/goals");
  revalidatePath("/");
}

// ── Sunrise & sunset ──────────────────────────────────────────

export async function setSunriseSunset(
  month: string,
  sunriseDone: boolean,
  sunsetDone: boolean
) {
  const { supabase, user } = await authed();
  fmt(month, MONTH, "Month");
  await ok(supabase.from("sunrise_sunset").upsert(
    { user_id: user.id, month, sunrise_done: sunriseDone, sunset_done: sunsetDone },
    { onConflict: "user_id,month" }
  ));
  revalidatePath("/");
}

// ── Books ─────────────────────────────────────────────────────

export async function updateBookPage(id: string, currentPage: number) {
  const { supabase } = await authed();
  num(currentPage, "Page", 0);
  await ok(supabase.from("book").update({ current_page: currentPage }).eq("id", id));
  revalidatePath("/");
  revalidatePath("/books");
}

export async function markBookFinished(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("book").update({
    status: "finished",
    date_finished: todayStr(),
    current_page: null,
  }).eq("id", id));
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
  const { supabase, user } = await authed();
  for (const k of ["total_pages", "current_page", "rating"] as const) if (data[k] != null) num(data[k], k, 0);
  await ok(supabase.from("book").insert({
    user_id: user.id,
    title: str(data.title, "Title"),
    author: str(data.author, "Author"),
    status: data.status,
    total_pages: data.total_pages,
    current_page: data.current_page,
    rating: data.rating,
    notes: cap(data.notes, "Notes", 10000),
  }));
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
  const { supabase } = await authed();
  if (data.date_finished != null) fmt(data.date_finished, DATE, "Date finished");
  for (const k of ["total_pages", "current_page", "rating"] as const) if (data[k] != null) num(data[k], k, 0);
  // Explicit picks; undefined keys are dropped when the body is serialised.
  await ok(supabase.from("book").update({
    title: optStr(data.title, "Title"),
    author: optStr(data.author, "Author"),
    status: data.status,
    total_pages: data.total_pages,
    current_page: data.current_page,
    rating: data.rating,
    notes: cap(data.notes, "Notes", 10000),
    date_finished: data.date_finished,
  }).eq("id", id));
  revalidatePath("/books");
  revalidatePath("/");
}

export async function deleteBook(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("book").delete().eq("id", id));
  revalidatePath("/books");
  revalidatePath("/");
}

// ── Learning tracks ───────────────────────────────────────────

// http(s) only, so a stored link can never be a javascript: URL.
function link(v: string | null | undefined) {
  if (v == null || v.trim() === "") return null;
  const u = v.trim();
  if (u.length > 2000 || !/^https?:\/\/\S+$/i.test(u)) throw new Error("Link must start with http:// or https://");
  return u;
}

type StepIn = { id: string; title: string; done: boolean };

// Steps live in one jsonb column; the counters and current_label are derived so the home card keeps reading them.
// ponytail: whole-array write, last save wins. Fine for one user; move to a learning_step table if two tabs ever fight.
function stepColumns(list: StepIn[]) {
  if (!Array.isArray(list) || list.length > 200) throw new Error("A track can have at most 200 steps");
  const steps = list.map((s) => ({ id: str(s.id, "Step id", 64), title: cap(s.title, "Step", 300) ?? "", done: s.done === true }));
  if (new Set(steps.map((s) => s.id)).size !== steps.length) throw new Error("Duplicate step");
  return {
    steps,
    total_steps: steps.length,
    completed_steps: steps.filter((s) => s.done).length,
    current_label: steps.find((s) => !s.done)?.title ?? "",
  };
}

export async function addTrack(data: {
  name: string;
  total_steps: number;
  current_label: string;
  accent: "amber" | "sky";
}) {
  const { supabase, user } = await authed();
  const n = Math.min(Math.floor(num(data.total_steps, "Total steps", 0)), 200);
  const first = cap(data.current_label, "Label", 300) ?? "";
  await ok(supabase.from("learning_track").insert({
    user_id: user.id,
    name: str(data.name, "Name"),
    accent: data.accent,
    ...stepColumns(Array.from({ length: n }, (_, i) => ({ id: crypto.randomUUID(), title: i === 0 ? first : "", done: false }))),
  }));
  revalidatePath("/learning");
  revalidatePath("/");
}

export async function updateTrack(
  id: string,
  data: {
    name?: string;
    accent?: "amber" | "sky";
    url?: string | null;
    notes?: string | null;
  }
) {
  const { supabase } = await authed();
  await ok(supabase.from("learning_track").update({
    name: optStr(data.name, "Name"),
    accent: data.accent,
    url: data.url === undefined ? undefined : link(data.url),
    notes: cap(data.notes, "Notes", 10000),
  }).eq("id", id));
  revalidatePath("/learning");
  revalidatePath("/");
}

export async function saveTrackSteps(id: string, steps: StepIn[]) {
  const { supabase } = await authed();
  await ok(supabase.from("learning_track").update(stepColumns(steps)).eq("id", id));
  revalidatePath("/learning");
  revalidatePath("/");
}

export async function setActiveTrack(activeId: string) {
  const { supabase, user } = await authed();
  // Promote first: if the second write fails there are two ambers, never zero.
  await ok(supabase
    .from("learning_track")
    .update({ accent: "amber" })
    .eq("id", activeId));
  await ok(supabase
    .from("learning_track")
    .update({ accent: "sky" })
    .eq("user_id", user.id)
    .neq("id", activeId));
  revalidatePath("/learning");
  revalidatePath("/");
}

export async function deleteTrack(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("learning_track").delete().eq("id", id));
  revalidatePath("/learning");
  revalidatePath("/");
}

// ── Ideas ─────────────────────────────────────────────────────

export async function addIdea(data: {
  tag: string;
  text: string;
  effort: string;
}) {
  const { supabase, user } = await authed();
  await ok(supabase.from("idea").insert({
    user_id: user.id,
    tag: cap(data.tag, "Tag"),
    text: str(data.text, "Idea", 10000),
    effort: cap(data.effort, "Effort"),
    archived: false,
  }));
  revalidatePath("/ideas");
  revalidatePath("/");
}

export async function archiveIdea(id: string, archived: boolean) {
  const { supabase } = await authed();
  await ok(supabase.from("idea").update({ archived }).eq("id", id));
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
  const { supabase, user } = await authed();
  if (!Number.isInteger(data.year)) throw new Error("Year must be a whole number");
  await ok(supabase.from("target").insert({
    user_id: user.id,
    name: str(data.name, "Name"),
    kind: data.kind,
    goal: num(data.goal, "Goal"),
    unit: cap(data.unit, "Unit"),
    year: data.year,
    current: 0,
  }));
  revalidatePath("/targets");
  revalidatePath("/");
}

export async function updateTarget(
  id: string,
  current: number,
  goal: number
) {
  const { supabase } = await authed();
  num(current, "Current");
  num(goal, "Goal");
  await ok(supabase.from("target").update({ current, goal }).eq("id", id));
  revalidatePath("/targets");
  revalidatePath("/");
}

export async function deleteTarget(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("target").delete().eq("id", id));
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
  const { supabase, user } = await authed();
  birthday(data.month, data.day);
  await ok(supabase.from("recurring_date").insert({
    user_id: user.id,
    name: str(data.name, "Name"),
    month: data.month,
    day: data.day,
    relationship: cap(data.relationship, "Relationship"),
    lead_days: num(data.lead_days, "Lead days", 0),
  }));
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
  const { supabase } = await authed();
  if (data.lead_days !== undefined) num(data.lead_days, "Lead days", 0);
  birthday(data.month, data.day);
  await ok(supabase.from("recurring_date").update({
    name: optStr(data.name, "Name"),
    month: data.month,
    day: data.day,
    relationship: cap(data.relationship, "Relationship"),
    lead_days: data.lead_days,
  }).eq("id", id));
  revalidatePath("/birthdays");
  revalidatePath("/");
}

export async function deleteBirthday(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("recurring_date").delete().eq("id", id));
  revalidatePath("/birthdays");
  revalidatePath("/");
}

// ── Reflections ───────────────────────────────────────────────

export async function addReflection(name: string) {
  const { supabase, user } = await authed();
  await ok(supabase.from("reflection").insert({ user_id: user.id, name: str(name, "Name") }));
  revalidatePath("/reflection");
  revalidatePath("/");
}

export async function addReflectionNote(
  reflectionId: string,
  text: string
) {
  const { supabase, user } = await authed();
  await ok(supabase.from("reflection_note").insert({
    user_id: user.id,
    reflection_id: reflectionId,
    text: str(text, "Note", 10000),
  }));
  revalidatePath("/reflection");
  revalidatePath("/");
}

export async function deleteReflectionNote(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("reflection_note").delete().eq("id", id));
  revalidatePath("/reflection");
  revalidatePath("/");
}

export async function deleteReflection(id: string) {
  const { supabase } = await authed();
  // reflection_note rows go with it (FK on delete cascade).
  await ok(supabase.from("reflection").delete().eq("id", id));
  revalidatePath("/reflection");
  revalidatePath("/");
}

// ── Weekly goals ─────────────────────────────────────────────

export async function addWeeklyGoal(text: string, week: string, target: number) {
  const { supabase, user } = await authed();
  fmt(week, DATE, "Week");
  num(target, "Target", 0); // 0 = checkbox goal
  // New goals land at the bottom of that week.
  const last = await ok(supabase.from("weekly_goal").select("position").eq("week", week).order("position", { ascending: false }).limit(1).maybeSingle());
  await ok(supabase.from("weekly_goal").insert({ user_id: user.id, text: str(text, "Goal"), week, done: false, target, current: 0, position: (last?.position ?? 0) + 1 }));
  revalidatePath("/");
}

export async function reorderWeeklyGoal(id: string, position: number) {
  const { supabase } = await authed();
  await ok(supabase.from("weekly_goal").update({ position: num(position, "Position") }).eq("id", id));
  revalidatePath("/");
}

export async function setWeeklyGoalProgress(id: string, current: number, target: number) {
  const { supabase } = await authed();
  num(current, "Progress", 0);
  num(target, "Target", 0);
  await ok(supabase.from("weekly_goal").update({ current, done: current >= target }).eq("id", id));
  revalidatePath("/");
}

export async function toggleWeeklyGoal(id: string, done: boolean) {
  const { supabase } = await authed();
  await ok(supabase.from("weekly_goal").update({ done }).eq("id", id));
  revalidatePath("/");
}

export async function deleteWeeklyGoal(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("weekly_goal").delete().eq("id", id));
  revalidatePath("/");
}

// ── Habits ────────────────────────────────────────────────────

function habitColor(v: string) {
  if (typeof v !== "string" || !Object.hasOwn(HABIT_COLORS, v)) throw new Error("Unknown colour");
  return v;
}

export async function addHabit(name: string, color: string) {
  const { supabase, user } = await authed();
  await ok(supabase.from("habit").insert({ user_id: user.id, name: str(name, "Name"), color: habitColor(color) }));
  revalidatePath("/habits");
  revalidatePath("/");
}

export async function setHabitColor(id: string, color: string) {
  const { supabase } = await authed();
  await ok(supabase.from("habit").update({ color: habitColor(color) }).eq("id", id));
  revalidatePath("/habits");
  revalidatePath("/");
}

export async function deleteHabit(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("habit").delete().eq("id", id));
  revalidatePath("/habits");
  revalidatePath("/");
}

export async function toggleHabitLog(habitId: string, date: string, isDone: boolean) {
  const { supabase, user } = await authed();
  fmt(date, DATE, "Date");
  if (isDone) {
    // Double-tap safe: unique (habit_id, date), duplicates ignored.
    await ok(supabase.from("habit_log").upsert(
      { user_id: user.id, habit_id: habitId, date },
      { onConflict: "habit_id,date", ignoreDuplicates: true }
    ));
  } else {
    await ok(supabase.from("habit_log").delete().eq("habit_id", habitId).eq("date", date));
  }
  revalidatePath("/");
  revalidatePath("/habits");
}

// ── Notes / Projects ─────────────────────────────────────────

async function topPosition(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const data = await ok(supabase
    .from("notes").select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle());
  return (data?.position ?? 0) - 1;
}

export async function deleteProject(id: string) {
  const { supabase } = await authed();
  // Storage objects don't cascade with the row — clear them first.
  const files = await ok(supabase.from("project_files").select("path").eq("project_id", id));
  if (files?.length) {
    await ok(supabase.storage.from("project-files").remove(files.map((f) => f.path)));
  }
  await ok(supabase.from("projects").delete().eq("id", id));
  revalidatePath("/notes");
  revalidatePath("/");
}

export async function updateProject(id: string, data: {
  title?: string;
  area?: "career" | "personal";
  status?: "active" | "seed" | "done";
  why?: string | null;
  repo_url?: string | null;
  live_url?: string | null;
}) {
  const { supabase } = await authed();
  // Explicit picks: touched_at must not move on a metadata edit.
  await ok(supabase.from("projects").update({
    title: optStr(data.title, "Title"),
    area: data.area,
    status: data.status,
    why: cap(data.why, "Why", 10000),
    repo_url: cap(data.repo_url, "Repo URL", 2000),
    live_url: cap(data.live_url, "Live URL", 2000),
  }).eq("id", id));
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  revalidatePath("/");
}

export async function addProjectNote(projectId: string, body: string) {
  const { supabase, user } = await authed();
  body = str(body, "Note", 10000);
  const position = await topPosition(supabase, projectId);
  await Promise.all([
    ok(supabase.from("notes").insert({ user_id: user.id, project_id: projectId, body, source: "manual", position })),
    ok(supabase.from("projects").update({ touched_at: new Date().toISOString() }).eq("id", projectId)),
  ]);
  revalidatePath(`/notes/${projectId}`);
  revalidatePath("/notes");
  revalidatePath("/");
}

export async function toggleNote(noteId: string, done: boolean) {
  const { supabase } = await authed();
  await ok(supabase.from("notes").update({ done }).eq("id", noteId));
  revalidatePath("/notes");
  revalidatePath("/notes/[id]", "page");
  revalidatePath("/");
}

export async function reorderNote(noteId: string, position: number, projectId: string) {
  const { supabase } = await authed();
  num(position, "Position");
  await ok(supabase.from("notes").update({ position }).eq("id", noteId));
  revalidatePath(`/notes/${projectId}`);
  revalidatePath("/notes");
  revalidatePath("/");
}

export async function recordProjectFile(projectId: string, name: string, path: string, size: number) {
  const { supabase, user } = await authed();
  // The stored path is later handed to storage.remove — keep it inside the owner's folder.
  if (typeof path !== "string" || !path.startsWith(`${user.id}/${projectId}/`) || path.split("/").includes("..") || path.length > 1000) {
    throw new Error("Invalid file path");
  }
  await ok(supabase.from("project_files").insert({
    user_id: user.id,
    project_id: projectId,
    name: str(name, "File name"),
    path,
    size: num(size, "File size", 0),
  }));
  revalidatePath(`/notes/${projectId}`);
}

export async function deleteProjectFile(id: string) {
  const { supabase } = await authed();
  const file = await ok(supabase.from("project_files").select("path").eq("id", id).maybeSingle());
  if (file) {
    // Object first: a failure here leaves the row, so the file stays visible and retryable.
    await ok(supabase.storage.from("project-files").remove([file.path]));
    await ok(supabase.from("project_files").delete().eq("id", id));
  }
  revalidatePath("/notes");
  revalidatePath("/notes/[id]", "page");
}

export async function assignNoteToProject(noteId: string, projectId: string) {
  const { supabase } = await authed();
  const position = await topPosition(supabase, projectId);
  await ok(supabase.from("notes").update({ project_id: projectId, position }).eq("id", noteId));
  await ok(supabase.from("projects").update({ touched_at: new Date().toISOString() }).eq("id", projectId));
  revalidatePath("/notes");
  revalidatePath("/notes/sort");
  revalidatePath(`/notes/${projectId}`);
  revalidatePath("/");
}

export async function promoteNoteToProject(noteId: string, title: string, area: "career" | "personal") {
  const { supabase, user } = await authed();
  const project = await ok(supabase
    .from("projects")
    .insert({ user_id: user.id, title: str(title, "Title"), area, status: "seed", touched_at: new Date().toISOString() })
    .select("id")
    .single());
  if (!project) throw new Error("Project wasn't created"); // type guard: single() is typed nullable
  try {
    // Brand-new project, so the note is its only to-do: position 0.
    await ok(supabase.from("notes").update({ project_id: project.id, position: 0 }).eq("id", noteId));
  } catch (e) {
    // Roll back so a retry doesn't leave a duplicate empty project.
    await ok(supabase.from("projects").delete().eq("id", project.id)).catch(console.error); // best effort — the original error wins
    throw e;
  }
  revalidatePath("/notes");
  revalidatePath("/notes/sort");
}

export async function deleteNote(noteId: string) {
  const { supabase } = await authed();
  await ok(supabase.from("notes").delete().eq("id", noteId));
  revalidatePath("/notes");
  revalidatePath("/notes/sort");
  revalidatePath("/notes/[id]", "page");
  revalidatePath("/");
}

export async function quickCapture(body: string) {
  const { supabase, user } = await authed();
  await ok(supabase.from("notes").insert({ user_id: user.id, body: str(body, "Note", 10000), source: "quick-capture", project_id: null }));
  revalidatePath("/notes");
}

// ── Budget ───────────────────────────────────────────────────

export async function addExpense(data: {
  amount: number;
  category_id: string | null;
  note?: string | null;
  spent_on: string;
}) {
  const { supabase, user } = await authed();
  await ok(supabase.from("expenses").insert({
    user_id: user.id,
    amount: pos(data.amount, "Amount"),
    category_id: data.category_id,
    note: cap(data.note, "Note"),
    spent_on: fmt(data.spent_on, DATE, "Date"),
  }));
  revalidatePath("/budget");
}

export async function deleteExpense(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("expenses").delete().eq("id", id));
  revalidatePath("/budget");
}

export async function addCategory(name: string, budget?: number | null) {
  const { supabase, user } = await authed();
  if (budget != null) pos(budget, "Budget");
  await ok(supabase.from("budget_categories").insert({ user_id: user.id, name: str(name, "Name"), budget: budget ?? null }));
  revalidatePath("/budget");
}

export async function setCategoryBudget(id: string, budget: number | null) {
  const { supabase } = await authed();
  if (budget != null) pos(budget, "Budget");
  await ok(supabase.from("budget_categories").update({ budget }).eq("id", id));
  revalidatePath("/budget");
}

export async function renameCategory(id: string, name: string) {
  const { supabase } = await authed();
  await ok(supabase.from("budget_categories").update({ name: str(name, "Name") }).eq("id", id));
  revalidatePath("/budget");
}

export async function deleteCategory(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("budget_categories").delete().eq("id", id));
  revalidatePath("/budget");
}

export async function setAllowance(amount: number) {
  const { supabase, user } = await authed();
  num(amount, "Allowance", 0); // 0 is allowed: the UI uses it to clear the allowance
  await ok(supabase.from("budget_settings").upsert(
    { user_id: user.id, allowance: amount },
    { onConflict: "user_id" }
  ));
  revalidatePath("/budget");
}

export async function seedDefaultCategories() {
  const { supabase, user } = await authed();
  const defaults = ["Groceries", "Gas", "Dining", "Fun", "Other"];
  await ok(supabase
    .from("budget_categories")
    .insert(defaults.map((name) => ({ user_id: user.id, name }))));
  revalidatePath("/budget");
}

// ── School ───────────────────────────────────────────────────

export async function saveSchoolClass(data: {
  id?: string;
  name: string;
  days: number[];
  start_time: string | null;
  color: string;
}) {
  const { supabase, user } = await authed();
  if (!Array.isArray(data.days) || data.days.length > 7 || !data.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
    throw new Error("Days must be weekdays 1-7");
  }
  await ok(supabase.from("school_class").upsert({
    ...(data.id ? { id: data.id } : {}),
    user_id: user.id,
    name: str(data.name, "Name"),
    days: data.days,
    start_time: cap(data.start_time, "Start time", 8),
    color: fmt(data.color, /^#[0-9a-fA-F]{6}$/, "Colour"),
  }));
  revalidatePath("/school");
  revalidatePath("/");
}

export async function deleteSchoolClass(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("school_class").delete().eq("id", id));
  revalidatePath("/school");
  revalidatePath("/");
}

export async function addSchoolItem(data: {
  title: string;
  class_id: string;
  kind: "assignment" | "exam";
  due_on: string;
}) {
  const { supabase, user } = await authed();
  // New items land at the bottom of the weekly to-do.
  const last = await ok(supabase
    .from("school_item")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle());
  await ok(supabase.from("school_item").insert({
    user_id: user.id,
    title: str(data.title, "Title"),
    class_id: data.class_id,
    kind: data.kind,
    due_on: fmt(data.due_on, DATE, "Due date"),
    position: (last?.position ?? 0) + 1,
  }));
  revalidatePath("/school");
  revalidatePath("/");
}

export async function reorderSchoolItem(id: string, position: number) {
  const { supabase } = await authed();
  num(position, "Position");
  await ok(supabase.from("school_item").update({ position }).eq("id", id));
  revalidatePath("/school");
}

export async function moveSchoolItem(id: string, dueOn: string) {
  const { supabase } = await authed();
  await ok(supabase.from("school_item").update({ due_on: fmt(dueOn, DATE, "Due date") }).eq("id", id));
  revalidatePath("/school");
  revalidatePath("/");
}

export async function toggleSchoolItem(id: string, done: boolean) {
  const { supabase } = await authed();
  await ok(supabase.from("school_item").update({ done }).eq("id", id));
  revalidatePath("/school");
  revalidatePath("/");
}

export async function deleteSchoolItem(id: string) {
  const { supabase } = await authed();
  await ok(supabase.from("school_item").delete().eq("id", id));
  revalidatePath("/school");
  revalidatePath("/");
}

// ── Life goals ────────────────────────────────────────────────

function revalidateLife() {
  revalidatePath("/life");
  revalidatePath("/");
}

type SeedGoal = {
  id: string; title: string; emoji: string; category: string; type: string; active: boolean; status: string;
  why?: string; firstMove?: string; nextMove?: string; targetDate?: string;
  steps?: LifeStep[]; count?: { current: number; seasonTarget?: number; lifetimeTarget?: number };
  requires?: string[]; imageQuery?: string;
};

// First-run import of lib/life-goals.json. Existing slugs are left alone, so re-running never overwrites edits.
export async function seedLifeGoals() {
  const { supabase, user } = await authed();
  const rows = (lifeSeed.goals as SeedGoal[]).map((g, i) => ({
    user_id: user.id,
    slug: g.id,
    title: g.title,
    emoji: g.emoji,
    category: g.category,
    type: g.type,
    active: g.active,
    status: g.status,
    why: g.why ?? null,
    first_move: g.firstMove ?? null,
    next_move: g.nextMove ?? null,
    target_date: g.targetDate ?? null,
    steps: g.steps ?? [],
    count_current: g.count?.current ?? 0,
    season_target: g.count?.seasonTarget ?? null,
    lifetime_target: g.count?.lifetimeTarget ?? null,
    requires: g.requires ?? [],
    image_query: g.imageQuery ?? null,
    position: i,
  }));
  await ok(supabase.from("life_goal").upsert(rows, { onConflict: "user_id,slug", ignoreDuplicates: true }));
  revalidateLife();
}

export async function addLifeGoal(title: string, category: string) {
  const { supabase, user } = await authed();
  if (!(LIFE_CATEGORIES as readonly string[]).includes(category)) throw new Error("Category is not valid");
  const last = await ok(supabase.from("life_goal").select("position").order("position", { ascending: false }).limit(1).maybeSingle());
  await ok(supabase.from("life_goal").insert({
    user_id: user.id,
    slug: crypto.randomUUID(),
    title: str(title, "Title", 200),
    emoji: "✨",
    category,
    position: (last?.position ?? 0) + 1,
  }));
  revalidateLife();
}

type LifeGoalEdit = Partial<Pick<LifeGoal,
  "title" | "emoji" | "category" | "active" | "why" | "first_move" | "next_move" | "target_date" | "notes" | "cover_url" | "season_target" | "lifetime_target"
>>;

// Empty text clears the field. Absent keys are left alone (undefined is dropped from the update).
const blank = (v: string | null | undefined, label: string, max = 500) =>
  v === undefined ? undefined : cap(v, label, max)?.trim() || null;

const target = (v: number | null | undefined, label: string) =>
  v == null ? v : Math.round(num(v, label, 0));

export async function saveLifeGoal(id: string, f: LifeGoalEdit) {
  const { supabase } = await authed();
  if (f.category !== undefined && !(LIFE_CATEGORIES as readonly string[]).includes(f.category)) throw new Error("Category is not valid");
  if (f.active !== undefined && typeof f.active !== "boolean") throw new Error("Active is not valid");
  await ok(supabase.from("life_goal").update({
    title: f.title === undefined ? undefined : str(f.title, "Title", 200),
    emoji: f.emoji === undefined ? undefined : (cap(f.emoji, "Icon", 16) ?? "").trim(),
    category: f.category,
    active: f.active,
    why: blank(f.why, "Why", 2000),
    first_move: blank(f.first_move, "First move"),
    next_move: blank(f.next_move, "Next move"),
    target_date: f.target_date ? fmt(f.target_date, DATE, "Target date") : f.target_date === undefined ? undefined : null,
    notes: blank(f.notes, "Notes", 5000),
    // A hand-pasted cover drops the old photographer credit.
    ...(f.cover_url === undefined ? {} : { cover_url: link(f.cover_url), cover_credit: null }),
    season_target: target(f.season_target, "Season target"),
    lifetime_target: target(f.lifetime_target, "Lifetime target"),
  }).eq("id", id));
  revalidateLife();
}

// ponytail: whole-array write, last save wins (same trade as learning_track.steps).
export async function saveLifeGoalSteps(id: string, list: LifeStep[]) {
  const { supabase } = await authed();
  if (!Array.isArray(list) || list.length > 50) throw new Error("A goal can have at most 50 steps");
  const steps = list.map((s) => ({
    label: str(s.label, "Step", 200),
    done: s.done === true,
    ...(s.done === true && s.doneDate ? { doneDate: fmt(s.doneDate, DATE, "Step date") } : {}),
  }));
  await ok(supabase.from("life_goal").update({ steps }).eq("id", id));
  revalidateLife();
}

export async function setLifeCount(id: string, current: number) {
  const { supabase } = await authed();
  await ok(supabase.from("life_goal").update({ count_current: Math.round(num(current, "Count", 0)) }).eq("id", id));
  revalidateLife();
}

// "Today's move" done: log it and clear it, so the card asks for the next one.
export async function completeMove(goalId: string) {
  const { supabase, user } = await authed();
  const goal = await ok(supabase.from("life_goal").select("next_move").eq("id", goalId).maybeSingle());
  if (!goal?.next_move) throw new Error("That goal has no next move to finish");
  await ok(supabase.from("life_move_log").insert({ user_id: user.id, goal_id: goalId, move: goal.next_move, done_on: todayStr() }));
  await ok(supabase.from("life_goal").update({ next_move: null }).eq("id", goalId));
  revalidateLife();
}

export async function setLifeGoalDone(id: string, done: boolean) {
  const { supabase } = await authed();
  if (done) {
    await ok(supabase.from("life_goal").update({ status: "done", completed_on: todayStr() }).eq("id", id));
  } else {
    const goal = await ok(supabase.from("life_goal").select("active").eq("id", id).maybeSingle());
    await ok(supabase.from("life_goal").update({ status: goal?.active ? "active" : "someday", completed_on: null }).eq("id", id));
  }
  revalidateLife();
}

// The browser uploads to the goal-photos bucket, then records the path here. null removes the photo.
export async function setLifeGoalPhoto(id: string, path: string | null) {
  const { supabase, user } = await authed();
  // The stored path is later handed to storage.remove — keep it inside the owner's folder.
  if (path !== null && (typeof path !== "string" || !path.startsWith(`${user.id}/${id}/`) || path.split("/").includes("..") || path.length > 1000)) {
    throw new Error("Invalid photo path");
  }
  const goal = await ok(supabase.from("life_goal").select("photo_path").eq("id", id).maybeSingle());
  if (!goal) throw new Error("Goal not found");
  await ok(supabase.from("life_goal").update({ photo_path: path }).eq("id", id));
  // Row first: if this remove fails the old object is only an orphan, never a broken cover.
  if (goal.photo_path && goal.photo_path !== path) await ok(supabase.storage.from("goal-photos").remove([goal.photo_path]));
  revalidateLife();
}

// Looks up a stock cover for every goal that has neither a cover nor my own photo.
// Stops at the first Unsplash error (rate limit is 50/hour on a demo key); covers saved before it stay.
export async function fillCovers() {
  const { supabase } = await authed();
  const goals = await ok(supabase.from("life_goal").select("id, image_query").is("cover_url", null).is("photo_path", null).not("image_query", "is", null).order("position"));
  for (const g of goals ?? []) {
    const cover = await findCover(g.image_query);
    if (cover) await ok(supabase.from("life_goal").update({ cover_url: cover.url, cover_credit: cover.credit }).eq("id", g.id));
  }
  revalidateLife();
}

export async function addCounterEntry(counter: string, name: string, happenedOn: string | null) {
  const { supabase, user } = await authed();
  if (!LIFE_COUNTERS.some((c) => c.key === counter)) throw new Error("Counter is not valid");
  await ok(supabase.from("life_counter_entry").insert({
    user_id: user.id,
    counter,
    name: str(name, "Name", 200),
    happened_on: happenedOn ? fmt(happenedOn, DATE, "Date") : null,
  }));
  revalidatePath("/life");
}

// A named item on a count goal (a song, a dish). Adding one counts as +1.
export async function addGoalEntry(goalId: string, name: string, happenedOn: string | null) {
  const { supabase, user } = await authed();
  const goal = await ok(supabase.from("life_goal").select("count_current").eq("id", goalId).maybeSingle());
  if (!goal) throw new Error("Goal not found");
  await ok(supabase.from("life_counter_entry").insert({
    user_id: user.id,
    goal_id: goalId,
    name: str(name, "Name", 200),
    happened_on: happenedOn ? fmt(happenedOn, DATE, "Date") : null,
  }));
  await ok(supabase.from("life_goal").update({ count_current: goal.count_current + 1 }).eq("id", goalId));
  revalidateLife();
}

export async function deleteCounterEntry(id: string) {
  const { supabase } = await authed();
  const entry = await ok(supabase.from("life_counter_entry").select("goal_id, life_media(path)").eq("id", id).maybeSingle());
  if (!entry) return;
  // Storage doesn't cascade: album files go first, so a failure leaves the entry visible and retryable.
  const paths = (entry.life_media ?? []).map((m) => m.path);
  if (paths.length) await ok(supabase.storage.from("goal-photos").remove(paths));
  await ok(supabase.from("life_counter_entry").delete().eq("id", id));
  if (entry.goal_id) {
    const goal = await ok(supabase.from("life_goal").select("count_current").eq("id", entry.goal_id).maybeSingle());
    if (goal) await ok(supabase.from("life_goal").update({ count_current: Math.max(0, goal.count_current - 1) }).eq("id", entry.goal_id));
  }
  revalidateLife();
}

// The browser uploads to the goal-photos bucket, then records each file here.
export async function recordLifeMedia(entryId: string, path: string, kind: string) {
  const { supabase, user } = await authed();
  // The stored path is later handed to storage.remove — keep it inside the owner's folder.
  if (typeof path !== "string" || !path.startsWith(`${user.id}/${entryId}/`) || path.split("/").includes("..") || path.length > 1000) {
    throw new Error("Invalid file path");
  }
  if (kind !== "image" && kind !== "video") throw new Error("Only photos and videos can go in an album");
  await ok(supabase.from("life_media").insert({ user_id: user.id, entry_id: entryId, path, kind }));
  revalidatePath("/life");
}

export async function deleteLifeMedia(id: string) {
  const { supabase } = await authed();
  const media = await ok(supabase.from("life_media").select("path").eq("id", id).maybeSingle());
  if (media) {
    // Object first: a failure here leaves the row, so the file stays visible and retryable.
    await ok(supabase.storage.from("goal-photos").remove([media.path]));
    await ok(supabase.from("life_media").delete().eq("id", id));
  }
  revalidatePath("/life");
}

// The first log also starts the streak clock if no start date is set yet.
export async function logJournal(date: string, on: boolean) {
  const { supabase, user } = await authed();
  fmt(date, DATE, "Date");
  if (on) {
    await ok(supabase.from("journal_log").upsert({ user_id: user.id, date }, { onConflict: "user_id,date", ignoreDuplicates: true }));
    const settings = await ok(supabase.from("user_settings").select("journal_start").maybeSingle());
    if (!settings?.journal_start) await ok(supabase.from("user_settings").upsert({ user_id: user.id, journal_start: date }));
  } else {
    await ok(supabase.from("journal_log").delete().eq("date", date));
  }
  revalidatePath("/");
}

export async function setJournalStart(date: string | null) {
  const { supabase, user } = await authed();
  await ok(supabase.from("user_settings").upsert({ user_id: user.id, journal_start: date ? fmt(date, DATE, "Start date") : null }));
  revalidatePath("/");
}
