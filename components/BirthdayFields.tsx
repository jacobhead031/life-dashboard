"use client";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate();
}

export type BirthdayDraft = {
  name: string;
  relationship: string;
  month: number;
  day: number;
  leadDays: string;
};

export const EMPTY_BIRTHDAY: BirthdayDraft = { name: "", relationship: "", month: 1, day: 1, leadDays: "7" };

export function BirthdayFields({
  value,
  onChange,
  relationshipPlaceholder,
  compact = false,
  onEnter,
}: {
  value: BirthdayDraft;
  onChange: (v: BirthdayDraft) => void;
  relationshipPlaceholder: string;
  compact?: boolean; // home card: one row, no lead days
  onEnter?: () => void;
}) {
  const who = (
    <>
      <div className="d-field" style={{ flex: compact ? 3 : 2 }}>
        <label>Name</label>
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Person's name"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        />
      </div>
      <div className="d-field">
        <label>Relationship</label>
        <input
          value={value.relationship}
          onChange={(e) => onChange({ ...value, relationship: e.target.value })}
          placeholder={relationshipPlaceholder}
        />
      </div>
    </>
  );

  const when = (
    <>
      <div className="d-field">
        <label>Month</label>
        <select
          value={value.month}
          onChange={(e) => {
            const m = parseInt(e.target.value);
            onChange({ ...value, month: m, day: value.day > daysInMonth(m) ? 1 : value.day });
          }}
        >
          {MONTHS.map((mn, i) => (
            <option key={i + 1} value={i + 1}>{mn}</option>
          ))}
        </select>
      </div>
      <div className="d-field">
        <label>Day</label>
        <select value={value.day} onChange={(e) => onChange({ ...value, day: parseInt(e.target.value) })}>
          {Array.from({ length: daysInMonth(value.month) }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
      </div>
    </>
  );

  if (compact) return <div className="d-form-row">{who}{when}</div>;

  return (
    <>
      <div className="d-form-row">{who}</div>
      <div className="d-form-row">
        {when}
        <div className="d-field">
          <label>Lead days</label>
          <input
            type="number"
            value={value.leadDays}
            onChange={(e) => onChange({ ...value, leadDays: e.target.value })}
            min={0}
            max={60}
            placeholder="7"
          />
        </div>
      </div>
    </>
  );
}
