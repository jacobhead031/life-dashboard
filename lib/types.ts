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

export type LearningStep = { id: string; title: string; done: boolean };

export type LearningTrack = {
  id: string;
  user_id: string;
  name: string;
  steps: LearningStep[]; // display order; the three fields below are derived from it on every save
  total_steps: number;
  completed_steps: number;
  current_label: string; // title of the first unchecked step
  url: string | null;
  notes: string | null;
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
  position: number;
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
  position: number;
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
  target_carbs_g: number | null; // tri fuel agent
  target_protein_g: number | null;
  ctl: number | null; // fitness, from Intervals.icu wellness
  atl: number | null; // fatigue
  vo2max: number | null; // Garmin via Intervals.icu
  steps: number | null;
  updated_at: string;
};

export type HealthRecs = {
  user_id: string;
  week_of: string; // YYYY-MM-DD (Sunday)
  recs: string[];
  updated_at: string;
};

export type SchoolClass = {
  id: string;
  user_id: string;
  name: string;
  days: number[]; // ISO weekday: 1=Mon .. 7=Sun
  start_time: string | null; // HH:MM:SS from Postgres
  color: string | null; // #RRGGBB
  created_at: string;
};

export type SchoolItem = {
  id: string;
  user_id: string;
  class_id: string;
  title: string;
  kind: "assignment" | "exam";
  due_on: string; // YYYY-MM-DD
  done: boolean;
  position: number;
  created_at: string;
};

export type LifeStep = { label: string; done: boolean; doneDate?: string }; // doneDate YYYY-MM-DD

export type LifeGoal = {
  id: string;
  user_id: string;
  slug: string; // stable id from lib/life-goals.json; `requires` holds these
  title: string;
  emoji: string;
  category: "Adventure" | "Body" | "Build" | "Skills" | "People" | "Mind";
  type: "experience" | "ladder" | "count" | "countdown" | "habit";
  active: boolean; // shows on the home card
  status: "someday" | "active" | "done";
  why: string | null;
  first_move: string | null;
  next_move: string | null;
  target_date: string | null; // YYYY-MM-DD
  steps: LifeStep[];
  count_current: number;
  season_target: number | null;
  lifetime_target: number | null;
  requires: string[];
  image_query: string | null;
  cover_url: string | null;
  cover_credit: string | null;
  photo_path: string | null; // the cover: path of one image in this goal's album; wins over cover_url
  completed_on: string | null; // YYYY-MM-DD
  notes: string | null;
  position: number;
  created_at: string;
};

export type LifeCounterEntry = {
  id: string;
  user_id: string;
  counter: "countries" | "continents" | "wonders" | "concerts" | null; // null when it belongs to a goal
  goal_id: string | null; // a named item on a count goal (a song, a dish)
  name: string;
  happened_on: string | null; // YYYY-MM-DD
  notes: string | null; // the recipe, the review, the story
  created_at: string;
};

export type LifeMedia = {
  id: string;
  user_id: string;
  entry_id: string | null; // album of a counter entry or goal item…
  goal_id: string | null; // …or of a goal itself; exactly one is set
  path: string; // goal-photos bucket: <user_id>/<entry_id or goal_id>/<ts>-<filename>
  kind: "image" | "video";
  created_at: string;
};

// ── Triathlon coach (/coach) ──────────────────────────────────
export type TriPoolSlot = { pool: string; kind?: string; label?: string; weekday: number; start: string; end: string; valid_from: string; valid_to: string };

export type TriProfile = {
  user_id: string;
  race_date: string; // YYYY-MM-DD
  goal_s: number; // seconds
  floor_s: number | null;
  stretch_s: number | null;
  ftp_watts: number | null;
  css_s_100m: number | null;
  thr_run_s_km: number | null;
  lthr: number | null;
  max_hr: number | null;
  weight_kg: number | null;
  hockey_days: number[]; // ISO weekday 1=Mon..7=Sun
  pool_slots: TriPoolSlot[];
  updated_at: string;
};

export type TriPhase = {
  id: string;
  user_id: string;
  name: string;
  start_on: string;
  end_on: string;
  focus: string | null;
  hours_min: number | null;
  hours_max: number | null;
};

export type TriSport = "swim" | "bike" | "run" | "brick" | "strength" | "hockey" | "mobility" | "test" | "race" | "rest";
export type TriSessionStatus = "planned" | "adjusted" | "done" | "partial" | "skipped" | "moved";

export type TriSession = {
  id: string;
  user_id: string;
  date: string;
  slot: "am" | "pm";
  sport: TriSport;
  title: string;
  purpose: string | null;
  duration_min: number | null;
  structure: string | null; // Intervals.icu workout text
  is_key: boolean;
  location: string | null;
  status: TriSessionStatus;
  adjusted_reason: string | null;
  intervals_event_id: string | null;
  created_by: "season" | "weekly" | "daily" | "user";
  created_at: string;
  updated_at: string;
};

export type TriActivity = {
  id: string;
  user_id: string;
  intervals_activity_id: string;
  session_id: string | null;
  date: string;
  sport: string | null;
  duration_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  avg_watts: number | null;
  np_watts: number | null;
  pace_s_km: number | null;
  load: number | null;
  raw: Record<string, unknown> | null;
  created_at: string;
};

export type TriCheckin = {
  id: string;
  user_id: string;
  session_id: string | null;
  date: string;
  kind: "post_session" | "post_hockey" | "weekly" | "adhoc";
  channel: "email" | "tab" | "voice";
  rpe: number | null;
  legs: string | null;
  sleep: string | null;
  mood: string | null;
  pain: boolean;
  pain_where: string | null;
  notes: string | null;
  raw_text: string | null;
  crowd: number | null; // pool crowd 1-5 on swim days
  created_at: string;
};

export type TriGear = {
  id: string;
  user_id: string;
  rank: number | null;
  item: string;
  area: string | null;
  buy_by: string | null;
  status: "have" | "shopping" | "need" | "ordered";
  why: string | null;
};

export type TriMessage = {
  id: string;
  user_id: string;
  role: "athlete" | "coach";
  channel: "email" | "tab" | "voice";
  content: string;
  session_id: string | null;
  created_at: string;
};

export type TriLiftSet = {
  id: string;
  user_id: string;
  date: string;
  session_id: string | null;
  exercise: string;
  set_no: number;
  reps: number | null;
  weight_lb: number | null;
  rpe: number | null;
  created_at: string;
};

// ── Dates (/dates): a bucket list shared with user_settings.partner_id ────────
export type DateCost = "free" | "$" | "$$" | "$$$";
export type DateDuration = "1h" | "evening" | "half day" | "full day";

export type DateIdea = {
  id: string;
  user_id: string; // who added it; the partner sees it too
  kind: "activity" | "restaurant";
  title: string;
  note: string | null;
  url: string | null;
  category: string; // activities: a tag from the list; restaurants: the cuisine
  cost: DateCost;
  duration: DateDuration;
  event_on: string | null; // YYYY-MM-DD; null = anytime
  event_until: string | null;
  source: "manual" | "seed" | "weekly";
  want_more: boolean;
  position: number;
  done_on: string | null;
  review: string | null;
  created_at: string;
};

export type DateScore = { idea_id: string; user_id: string; score: number };

export type DateMedia = {
  id: string;
  idea_id: string;
  user_id: string;
  path: string; // date-photos bucket: <idea_id>/<ts>-<filename>
  kind: "image" | "video";
  created_at: string;
};
