import type { TriLiftSet } from "./types";

export type Exercise = { name: string; sets: number; reps: number; rpe: string; note: string; bodyweight: boolean };

const LOWER = /squat|deadlift|rdl|lunge/i;
const BODYWEIGHT = /chin-up|pull-up|plank|dead bug|knee raise|pallof/i;

/** Exercises from the session's structure text ("- Back squat (13 min): 4 x 5 @ RPE 7-8, rest 2:30 ...").
 *  A superset line becomes one exercise per lift with sets = rounds. */
export function parseExercises(structure: string | null): Exercise[] {
  const out: Exercise[] = [];
  for (const raw of (structure ?? "").split("\n")) {
    const m = raw.match(/^- (.+?) \(\d+ min\): (.*)$/);
    if (!m) continue;
    const [, head, detail] = m;
    if (/^(warm-up|core)$/i.test(head)) continue;
    const rpe = (detail.match(/RPE ([\d\-– ]+)/) || [])[1]?.trim() ?? "";
    if (/^superset:/i.test(head)) {
      const rounds = Number((detail.match(/(\d+) rounds/) || [])[1] ?? 4);
      for (const part of head.replace(/^superset:\s*/i, "").split(" + ")) {
        const name = part.trim();
        const reps = Number((detail.match(new RegExp(`${name.split(" ")[0]}\\w* (\\d+)`, "i")) || [])[1] ?? 5);
        out.push({ name: name[0].toUpperCase() + name.slice(1), sets: rounds, reps, rpe, note: detail, bodyweight: BODYWEIGHT.test(name) });
      }
      continue;
    }
    const sr = detail.match(/(\d+) x (\d+)/);
    out.push({ name: head, sets: Number(sr?.[1] ?? 3), reps: Number(sr?.[2] ?? 5), rpe, note: detail, bodyweight: BODYWEIGHT.test(head) });
  }
  return out;
}

export function suggest(last: TriLiftSet[], ex: Exercise): { weight: number | null; text: string } {
  if (!last.length) return { weight: null, text: "first time: pick a weight you could do for 2 more reps" };
  const w = Math.max(...last.map((s) => s.weight_lb ?? 0));
  const hitReps = last.every((s) => (s.reps ?? 0) >= ex.reps) && last.length >= ex.sets;
  const easy = last.every((s) => s.rpe == null || s.rpe <= 7);
  const step = LOWER.test(ex.name) ? 10 : 5;
  if (hitReps && easy) return { weight: w + step, text: `last time ${w} lb for all sets at RPE ≤7 → try ${w + step} lb` };
  return { weight: w, text: `last time ${w} lb (${last.map((s) => s.reps ?? "?").join(", ")} reps) → floor is ${w} lb` };
}

