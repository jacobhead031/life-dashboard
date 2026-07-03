"use client";

import { useState } from "react";

export function BirthdayBanner({
  name,
  dayName,
  relLabel,
}: {
  name: string;
  dayName: string;
  relLabel: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bday">
      <span className="cake">🎂</span>
      <span className="b-text">
        <b>{name}&rsquo;s</b> birthday{" "}
        <span className="b-when">
          {dayName} · {relLabel}
        </span>
      </span>
      <button
        className="dismiss"
        onClick={() => setDismissed(true)}
        aria-label="dismiss birthday reminder"
      >
        ✕
      </button>
    </div>
  );
}
