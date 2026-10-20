import Link from "next/link";

export function TabNav({ active, guest = false }: { active: "dashboard" | "school" | "projects" | "health" | "coach" | "stats" | "budget" | "goals" | "dates"; guest?: boolean }) {
  if (guest) return null; // the partner only has /dates, so there is nothing to switch between
  return (
    <nav className="tab-nav">
      <Link href="/" className={`tab-link${active === "dashboard" ? " active" : ""}`}>
        Dashboard
      </Link>
      <Link href="/school" className={`tab-link${active === "school" ? " active" : ""}`}>
        School
      </Link>
      <Link href="/coach" className={`tab-link${active === "coach" ? " active" : ""}`}>
        Coach
      </Link>
      <Link href="/stats" className={`tab-link${active === "stats" ? " active" : ""}`}>
        Stats
      </Link>
      <Link href="/notes" className={`tab-link${active === "projects" ? " active" : ""}`}>
        Projects
      </Link>
      <Link href="/health" className={`tab-link${active === "health" ? " active" : ""}`}>
        Health
      </Link>
      <Link href="/budget" className={`tab-link${active === "budget" ? " active" : ""}`}>
        Budget
      </Link>
      <Link href="/life" className={`tab-link${active === "goals" ? " active" : ""}`}>
        Goals
      </Link>
      <Link href="/dates" className={`tab-link${active === "dates" ? " active" : ""}`}>
        Dates
      </Link>
    </nav>
  );
}
