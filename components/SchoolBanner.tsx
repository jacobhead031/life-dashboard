"use client";

import { useState } from "react";

export function SchoolBanner({
  title,
  kind,
  className,
  dayName,
  relLabel,
}: {
  title: string;
  kind: string;
  className: string;
  dayName: string;
  relLabel: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bday">
      <span className="cake">📚</span>
      <span className="b-text">
        <b>{title}</b> · {className} {kind}{" "}
        <span className="b-when">
          {dayName} · {relLabel}
        </span>
      </span>
      <button
        className="dismiss"
        onClick={() => setDismissed(true)}
        aria-label="dismiss school reminder"
      >
        ✕
      </button>
    </div>
  );
}
