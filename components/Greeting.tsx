"use client";

import { useEffect, useState } from "react";

export function Greeting() {
  const [greeting, setGreeting] = useState("good morning");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setGreeting(
      h < 12 ? "good morning" : h < 18 ? "good afternoon" : "good evening"
    );

    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const mons = [
      "jan","feb","mar","apr","may","jun",
      "jul","aug","sep","oct","nov","dec",
    ];
    setDateStr(`${days[now.getDay()]} · ${mons[now.getMonth()]} ${now.getDate()}`);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "16px", flex: 1 }}>
      <div className="greeting">
        {greeting},{" "}
        <span className="name">Jacob</span>
      </div>
      {dateStr && <div className="date-str">{dateStr}</div>}
    </div>
  );
}
