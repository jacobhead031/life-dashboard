// node lib/lifts.check.mjs — parser + progression rule
import assert from "node:assert/strict";
import { parseExercises, suggest } from "./lifts.ts";

const structure = `- Warm-up (5 min): 5 min easy bike
- Back squat (13 min): 4 x 5 @ RPE 7-8, rest 2:30. Depth to parallel
- Superset: bench press + chin-ups (12 min): 4 rounds: bench 5 @ RPE 7-8, straight into chin-ups 5 (add weight), rest 90 s
- Core (3 min): 2 x 45 s side plank`;
const ex = parseExercises(structure);
assert.deepEqual(ex.map((e) => [e.name, e.sets, e.reps, e.bodyweight]), [["Back squat", 4, 5, false], ["Bench press", 4, 5, false], ["Chin-ups", 4, 5, true]]);
assert.equal(ex[0].rpe, "7-8");
const sq = ex[0];
const row = (reps, w, rpe) => ({ reps, weight_lb: w, rpe, exercise: "Back squat", date: "2026-10-19", set_no: 1, id: "", user_id: "", session_id: null, created_at: "" });
assert.equal(suggest([], sq).weight, null);
assert.equal(suggest([row(5, 135, 7), row(5, 135, 7), row(5, 135, 7), row(5, 135, 7)], sq).weight, 145, "all sets hit at RPE 7 -> +10 lb lower");
assert.equal(suggest([row(5, 135, 8), row(4, 135, 9), row(5, 135, 8), row(5, 135, 8)], sq).weight, 135, "missed reps -> floor");
assert.equal(suggest([row(5, 95, 6), row(5, 95, 6), row(5, 95, 6), row(5, 95, 6)], ex[1]).weight, 100, "+5 lb upper");
console.log("lifts check ok");
