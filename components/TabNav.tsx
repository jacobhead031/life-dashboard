import Link from "next/link";

export function TabNav({ active }: { active: "dashboard" | "school" | "projects" | "health" | "budget" }) {
  return (
    <nav className="tab-nav">
      <Link href="/" className={`tab-link${active === "dashboard" ? " active" : ""}`}>
        Dashboard
      </Link>
      <Link href="/school" className={`tab-link${active === "school" ? " active" : ""}`}>
        School
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
    </nav>
  );
}
