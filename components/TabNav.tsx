import Link from "next/link";

// Tab order is this list. Move a line to move a tab; add a line to add one.
const TABS = [
  { key: "dashboard", href: "/", label: "Dashboard" },
  { key: "school", href: "/school", label: "School" },
  { key: "career", href: "/career", label: "Career" },
  { key: "coach", href: "/coach", label: "Coach" }, // /stats lives inside Coach now
  { key: "projects", href: "/notes", label: "Projects" },
  { key: "health", href: "/health", label: "Health" },
  { key: "budget", href: "/budget", label: "Budget" },
  { key: "goals", href: "/life", label: "Goals" },
  { key: "dates", href: "/dates", label: "Dates" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export function TabNav({ active, guest = false }: { active: TabKey; guest?: boolean }) {
  if (guest) return null; // the partner only has /dates, so there is nothing to switch between
  return (
    <nav className="tab-nav">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className={`tab-link${active === t.key ? " active" : ""}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
