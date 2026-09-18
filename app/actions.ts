"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayStr } from "@/lib/utils";

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
  if (typeof v !== "string" || !re.test(v)) throw new Error(`${label} is not a valid date`);
  return v;
}

// 2024 is a leap year, so Feb 29 passes. A lone day (month omitted) is checked against 31.
function birthday(month = 1, day = 1) {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Month must be 1-12");
  if (!Number.isInteger(day) || day < 1 || day > new Date(2024, month, 0).getDate()) throw new Error("Day isn't valid for that month");
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

export async function addTrack(data: {
  name: string;
  total_steps: number;
  current_label: string;
  accent: "amber" | "sky";
}) {
  const { supabase, user } = await authed();
  await ok(supabase.from("learning_track").insert({
    user_id: user.id,
    name: str(data.name, "Name"),
    total_steps: num(data.total_steps, "Total steps", 0),
    current_label: cap(data.current_label, "Label"),
    accent: data.accent,
    completed_steps: 0,
  }));
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
  const { supabase } = await authed();
  if (data.total_steps !== undefined) num(data.total_steps, "Total steps", 0);
  if (data.completed_steps !== undefined) num(data.completed_steps, "Completed steps", 0);
  await ok(supabase.from("learning_track").update({
    name: optStr(data.name, "Name"),
    total_steps: data.total_steps,
    completed_steps: data.completed_steps,
    current_label: cap(data.current_label, "Label"),
    accent: data.accent,
  }).eq("id", id));
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
  await ok(supabase.from("weekly_goal").insert({ user_id: user.id, text: str(text, "Goal"), week, done: false, target, current: 0 }));
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

export async function addHabit(name: string, color: string) {
  const { supabase, user } = await authed();
  await ok(supabase.from("habit").insert({ user_id: user.id, name: str(name, "Name"), color: str(color, "Color", 20) }));
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
