export type MonthlyGoal = {
  id: string;
  user_id: string;
  text: string;
  month: string; // YYYY-MM
  done: boolean;
  origin_month: string; // YYYY-MM — same as month unless carried over
  created_at: string;
  updated_at: string;
};

export type Target = {
  id: string;
  user_id: string;
  name: string;
  kind: "count" | "best";
  current: number;
  goal: number;
  unit: string | null;
  year: number;
  updated_at: string;
};

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  status: "reading" | "finished" | "abandoned";
  current_page: number | null;
  total_pages: number | null;
  rating: number | null; // 1–5
  notes: string | null;
  date_finished: string | null; // ISO date
  updated_at: string;
};

export type LearningTrack = {
  id: string;
  user_id: string;
  name: string;
  total_steps: number;
  completed_steps: number;
  current_label: string;
  accent: "amber" | "sky";
  updated_at: string;
};

export type Idea = {
  id: string;
  user_id: string;
  tag: string;
  text: string;
  effort: string;
  archived: boolean;
  updated_at: string;
};

export type RecurringDate = {
  id: string;
  user_id: string;
  name: string;
  month: number; // 1–12
  day: number; // 1–31
  relationship: string | null;
  lead_days: number; // default 7
  updated_at: string;
};

export type Reflection = {
  id: string;
  user_id: string;
  name: string;
  updated_at: string;
};

export type ReflectionNote = {
  id: string;
  reflection_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

export type WeeklyGoal = {
  id: string;
  user_id: string;
  text: string;
  week: string; // YYYY-MM-DD (Monday)
  done: boolean;
  target: number; // 0 = checkbox, >0 = progress goal
  current: number;
  created_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  color: string; // 'amber' | 'sky' | 'green' | 'coral'
  created_at: string;
  updated_at: string;
};

export type HabitLog = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
  created_at: string;
};

export type SunriseSunset = {
  user_id: string;
  month: string; // YYYY-MM
  sunrise_done: boolean;
  sunset_done: boolean;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  area: "career" | "personal";
  status: "active" | "seed" | "done";
  next_action: string | null;
  why: string | null;
  repo_url: string | null;
  live_url: string | null;
  created_at: string;
  updated_at: string;
  touched_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  project_id: string | null;
  body: string;
  source: string;
  done: boolean;
  created_at: string;
};

export type ProjectFile = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  path: string;
  size: number;
  created_at: string;
};

export type BudgetCategory = {
  id: string;
  user_id: string;
  name: string;
  budget: number | null; // monthly limit, null = not set
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  note: string | null;
  spent_on: string; // YYYY-MM-DD
  created_at: string;
};

export type BudgetSettings = {
  user_id: string;
  allowance: number;
};

export type HealthDay = {
  user_id: string;
  date: string; // YYYY-MM-DD
  recovery_pct: number | null;
  hrv: number | null;
  rhr: number | null;
  sleep_hours: number | null;
  strain: number | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  weight: number | null;
  updated_at: string;
};

export type HealthRecs = {
  user_id: string;
  week_of: string; // YYYY-MM-DD (Sunday)
  recs: string[];
  updated_at: string;
};
