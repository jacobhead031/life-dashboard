// Run: node lib/life.check.mjs
import assert from "node:assert/strict";
import { countryKey, distinctCountries, niceCountry } from "./countries.ts";
import { moveGoalForDay, nextStep, pickForDay, tickNextStep } from "./life.ts";

const list = ["a", "b", "c"];
assert.equal(pickForDay([], "2026-10-05"), null);
assert.equal(pickForDay(list, "2026-10-05"), pickForDay(list, "2026-10-05"));
assert.notEqual(pickForDay(list, "2026-10-05"), pickForDay(list, "2026-10-06"));
assert.equal(pickForDay(list, "2026-10-05"), pickForDay(list, "2026-10-08"));
assert.ok(list.includes(pickForDay(list, "1960-01-01"))); // negative day numbers still land in range

const goal = (over) => ({ active: true, status: "active", next_move: "go", ...over });
const only = goal({ next_move: "the one" });
const goals = [goal({ status: "done" }), goal({ active: false }), goal({ next_move: " " }), goal({ next_move: null }), only];
for (const day of ["2026-10-05", "2026-10-06", "2026-10-07"]) assert.equal(moveGoalForDay(goals, day), only);
assert.equal(moveGoalForDay([], "2026-10-05"), null);

const steps = [{ label: "one", done: true }, { label: "two", done: false }, { label: "three", done: false }];
assert.equal(nextStep(steps).label, "two");
const ticked = tickNextStep(steps, "2026-10-05");
assert.deepEqual(ticked[1], { label: "two", done: true, doneDate: "2026-10-05" });
assert.equal(ticked[2].done, false);
assert.equal(steps[1].done, false); // input untouched
assert.equal(nextStep(tickNextStep(ticked, "2026-10-06")), null);

// Countries: repeat trips and different spellings are one country.
assert.equal(distinctCountries(["France", "france ", "FRANCE"]), 1);
assert.equal(distinctCountries(["France", "Italy", "France"]), 2);
assert.equal(countryKey("USA"), countryKey(niceCountry("United States of America")));
assert.equal(countryKey("England"), countryKey("United Kingdom"));
assert.equal(countryKey("Curaçao"), countryKey("curacao"));
assert.equal(countryKey("Côte d'Ivoire"), countryKey("Ivory Coast"));
assert.equal(countryKey(niceCountry("Dominican Rep.")), countryKey("Dominican Republic"));
assert.equal(distinctCountries(["", "  "]), 0);

console.log("life.ts ok");
