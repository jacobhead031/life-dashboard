import Link from "next/link";

export function TabNav({ active }: { active: "dashboard" | "projects" }) {
  return (
    <nav className="tab-nav">
      <Link href="/" className={`tab-link${active === "dashboard" ? " active" : ""}`}>
        Dashboard
      </Link>
      <Link href="/notes" className={`tab-link${active === "projects" ? " active" : ""}`}>
        Projects
      </Link>
    </nav>
  );
}
