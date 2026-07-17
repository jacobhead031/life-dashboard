import Link from "next/link";

export function TabNav({ active }: { active: "dashboard" | "projects" | "health" }) {
  return (
    <nav className="tab-nav">
      <Link href="/" className={`tab-link${active === "dashboard" ? " active" : ""}`}>
        Dashboard
      </Link>
      <Link href="/notes" className={`tab-link${active === "projects" ? " active" : ""}`}>
        Projects
      </Link>
      <Link href="/health" className={`tab-link${active === "health" ? " active" : ""}`}>
        Health
      </Link>
    </nav>
  );
}
