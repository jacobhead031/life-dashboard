import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { Greeting } from "@/components/Greeting";
import { SignOutButton } from "@/components/SignOutButton";

// The nightly stretch: the same ~11 minutes every evening (same routine = it actually happens). Hips, hamstrings
// and calves for the run, hip flexors for the bike and hockey, upper back for the swim. Nothing overhead (shoulder).
// Links are YouTube searches, so they always find a current demo instead of a video that may be gone.
const ROUTINE: { name: string; hold: string; why: string; cue: string; search: string }[] = [
  { name: "Couch stretch", hold: "60 s each side", why: "hip flexors: bike, hockey, sitting all day",
    cue: "Kneel with the back foot up on the couch, squeeze the glute, stay tall; don't arch the lower back.", search: "couch stretch hip flexor" },
  { name: "Pigeon (or figure-4 on your back)", hold: "60 s each side", why: "glutes and outer hip",
    cue: "Shin across, hips square, fold forward only as far as the hip allows. Figure-4 lying down if the knee complains.", search: "pigeon stretch figure 4 glute" },
  { name: "Lying hamstring stretch with a strap", hold: "45 s each leg", why: "hamstrings: run and deadlift",
    cue: "On your back, towel or strap around the foot, leg straight, pull to a stretch not a fight. Other leg flat.", search: "lying hamstring stretch strap" },
  { name: "90/90 hip switches", hold: "8 slow reps each way", why: "hip rotation: hockey and running stride",
    cue: "Sit with both knees at 90°, rotate side to side, chest tall. Pause 5 s at each end.", search: "90 90 hip switch stretch" },
  { name: "Calf stretch on a step", hold: "30 s straight knee + 30 s bent knee, each leg", why: "calves and Achilles: run",
    cue: "Heel off the step, straight knee for the big calf, bent knee for the deep one. Breathe.", search: "calf stretch on step straight bent knee" },
  { name: "Open-book thoracic rotation", hold: "8 slow reps each side", why: "upper back and ribcage: swim rotation",
    cue: "On your side, knees bent, top arm opens like a book toward the floor behind you. Arms stay below shoulder height.", search: "open book thoracic rotation stretch" },
  { name: "Cat-cow", hold: "8 slow reps", why: "spine after a day at the library",
    cue: "Hands under shoulders, knees under hips; round up on the exhale, dip on the inhale.", search: "cat cow stretch" },
  { name: "Standing quad stretch at the wall", hold: "30 s each leg", why: "quads: bike and run",
    cue: "Hold the wall, heel to glute, knees together, hip pushed forward a touch.", search: "standing quad stretch wall" },
];

export default async function StretchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="wrap">
      <div className="top">
        <Greeting />
        <SignOutButton />
      </div>
      <div className="rule" />
      <TabNav active="coach" />
      <div className="grid-bento">
        <section className="card span-6" style={{ paddingBottom: 12 }}>
          <div className="card-label">
            <span>nightly stretch · about 11 min</span>
            <span className="coach-weeknav"><Link className="d-btn" href="/coach">← coach</Link></span>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--muted)" }}>
            Same routine every night, in this order. Easy breathing, no bouncing, nothing overhead. Skip anything that pinches.
          </p>
          {ROUTINE.map((s, i) => (
            <div key={s.name} className="coach-session" style={{ "--chip": "var(--sky)" } as React.CSSProperties}>
              <div className="coach-session-head">
                <strong>{i + 1}. {s.name}</strong>
                <span>{s.hold}</span>
                <span style={{ color: "var(--muted)" }}>· {s.why}</span>
              </div>
              <p style={{ margin: "4px 0 2px", fontSize: 14 }}>{s.cue}</p>
              <a className="d-btn" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(s.search)}`} target="_blank" rel="noreferrer">
                watch a demo ↗
              </a>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
