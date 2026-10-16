// Intervals.icu from the dashboard (server only): the Coach tab's Skipped and
// Move buttons must reach the watch, so they change the planned event here
// before the row in tri_session changes. Needs INTERVALS_API_KEY and
// INTERVALS_ATHLETE_ID in Vercel; without them the tab works, DB only.
const BASE = "https://intervals.icu/api/v1";

function cfg() {
  const key = process.env.INTERVALS_API_KEY;
  const id = process.env.INTERVALS_ATHLETE_ID;
  return key && id ? { key, id } : null;
}

export function intervalsConfigured() {
  return cfg() !== null;
}

async function req(method: string, path: string, body?: unknown) {
  const c = cfg();
  if (!c) return false;
  const r = await fetch(`${BASE}/athlete/${c.id}${path}`, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(`API_KEY:${c.key}`).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "apex-tri-coach",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Intervals.icu ${method} ${path}: ${r.status}`);
  return true;
}

/** Remove a planned workout (a skipped session must stop nagging on the watch). */
export const deleteEvent = (eventId: string) => req("DELETE", `/events/${eventId}`);

/** Move a planned workout to another day. */
export const moveEvent = (eventId: string, date: string) =>
  req("PUT", `/events/${eventId}`, { start_date_local: `${date}T00:00:00` });
