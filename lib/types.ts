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

export type SunriseSunset = {
  user_id: string;
  month: string; // YYYY-MM
  sunrise_done: boolean;
  sunset_done: boolean;
  updated_at: string;
};
