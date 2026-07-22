"use client";

import { useState, useTransition } from "react";
import {
  addExpense,
  deleteExpense,
  addCategory,
  renameCategory,
  deleteCategory,
  setCategoryBudget,
  setAllowance,
  seedDefaultCategories,
} from "@/app/actions";
import type { BudgetCategory, Expense } from "@/lib/types";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmt0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CIRC = 2 * Math.PI * 16;

function Ring({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(Math.max(pct, 0), 1);
  return (
    <svg className="cat-ring" viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r="16" fill="none" stroke="var(--base-2)" strokeWidth="3.5" />
      <circle
        cx="21" cy="21" r="16"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - clamped)}
        transform="rotate(-90 21 21)"
      />
    </svg>
  );
}
const ACCENTS = ["var(--amber)", "var(--sky)", "var(--green)", "var(--coral)"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

function dayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

export function BudgetContent({
  expenses,
  categories,
  allowance,
}: {
  expenses: Expense[];
  categories: BudgetCategory[];
  allowance: number;
}) {
  const [isPending, startTransition] = useTransition();

  // Last 12 month keys, oldest → newest
  const monthKeys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const [monthIdx, setMonthIdx] = useState(monthKeys.length - 1);
  const monthKey = monthKeys[monthIdx];

  // Add-expense form
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [spentOn, setSpentOn] = useState(localDateStr(now));

  // Allowance inline edit
  const [editingAllowance, setEditingAllowance] = useState(false);
  const [allowanceDraft, setAllowanceDraft] = useState("");

  // Category management
  const [managing, setManaging] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newCatBudget, setNewCatBudget] = useState("");

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const monthExpenses = expenses.filter((e) => e.spent_on.startsWith(monthKey));
  const spent = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const remaining = allowance - spent;
  const pct = allowance > 0 ? Math.min((spent / allowance) * 100, 100) : 0;
  const over = allowance > 0 && spent > allowance;

  // Category totals for the selected month
  const byCategory = new Map<string | null, number>();
  for (const e of monthExpenses) {
    byCategory.set(e.category_id, (byCategory.get(e.category_id) ?? 0) + Number(e.amount));
  }
  const catRings: { id: string | null; name: string; budget: number | null; spent: number }[] =
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      budget: c.budget != null ? Number(c.budget) : null,
      spent: byCategory.get(c.id) ?? 0,
    }));
  if (byCategory.has(null)) {
    catRings.push({ id: null, name: "Uncategorized", budget: null, spent: byCategory.get(null)! });
  }
  catRings.sort((a, b) => b.spent - a.spent);

  // Last 6 months trend
  const trendKeys = monthKeys.slice(-6);
  const trendTotals = trendKeys.map((k) =>
    expenses.filter((e) => e.spent_on.startsWith(k)).reduce((s, e) => s + Number(e.amount), 0)
  );
  const maxTrend = Math.max(...trendTotals, 1);

  function handleAddExpense() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !spentOn) return;
    setAmount("");
    setNote("");
    startTransition(() =>
      addExpense({
        amount: amt,
        category_id: categoryId || null,
        note: note.trim() || null,
        spent_on: spentOn,
      })
    );
  }

  function handleSaveAllowance() {
    const amt = parseFloat(allowanceDraft);
    setEditingAllowance(false);
    if (isNaN(amt) || amt < 0) return;
    startTransition(() => setAllowance(amt));
  }

  function handleAddCategory() {
    const name = newCat.trim();
    if (!name) return;
    const budget = parseFloat(newCatBudget);
    setNewCat("");
    setNewCatBudget("");
    startTransition(() => addCategory(name, budget > 0 ? budget : null));
  }

  return (
    <>
      <div className="month-nav">
        <button
          className="month-arrow"
          onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
          disabled={monthIdx === 0}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="month-nav-label">{monthLabel(monthKey)}</span>
        <button
          className="month-arrow"
          onClick={() => setMonthIdx((i) => Math.min(monthKeys.length - 1, i + 1))}
          disabled={monthIdx === monthKeys.length - 1}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid-bento">
        {/* Hero: remaining vs allowance */}
        <div className="card span-4">
          <div className="card-label">
            <span>{over ? "Over budget" : "Remaining"}</span>
            {!editingAllowance && (
              <button
                className="card-nav budget-edit-btn"
                onClick={() => {
                  setAllowanceDraft(allowance ? String(allowance) : "");
                  setEditingAllowance(true);
                }}
              >
                {allowance > 0 ? "edit allowance" : "set allowance"}
              </button>
            )}
          </div>
          {editingAllowance ? (
            <div className="allowance-edit">
              <input
                className="inline-input"
                type="number"
                min="0"
                step="0.01"
                autoFocus
                placeholder="monthly allowance"
                value={allowanceDraft}
                onChange={(e) => setAllowanceDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAllowance();
                  if (e.key === "Escape") setEditingAllowance(false);
                }}
                onBlur={handleSaveAllowance}
              />
            </div>
          ) : (
            <div className="stat-num" style={over ? { color: "var(--coral)" } : undefined}>
              {allowance > 0 ? fmt.format(remaining) : fmt.format(spent)}
            </div>
          )}
          <div className="stat-sub">
            {allowance > 0
              ? `${fmt.format(spent)} spent of ${fmt.format(allowance)}`
              : "spent this month · set an allowance to track remaining"}
          </div>
          {allowance > 0 && (
            <div className="bar budget-bar">
              <i
                style={{
                  width: `${pct}%`,
                  background: over
                    ? "var(--coral)"
                    : "linear-gradient(92deg, var(--amber), var(--coral))",
                }}
              />
            </div>
          )}
        </div>

        {/* Quick add */}
        <div className="card span-2">
          <div className="card-label"><span>Add expense</span></div>
          {categories.length === 0 ? (
            <div className="empty-state">
              <p>No categories yet.</p>
              <button
                className="empty-link"
                disabled={isPending}
                onClick={() => startTransition(() => seedDefaultCategories())}
              >
                Add starter categories →
              </button>
            </div>
          ) : (
            <div className="expense-form">
              <input
                className="quick-add-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="$ amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddExpense()}
              />
              <select
                className="quick-add-input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                className="quick-add-input"
                placeholder="note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddExpense()}
              />
              <input
                className="quick-add-input"
                type="date"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
              />
              <button
                className="btn primary budget-add-btn"
                onClick={handleAddExpense}
                disabled={isPending || !parseFloat(amount)}
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="card span-3">
          <div className="card-label">
            <span>By category</span>
            {categories.length > 0 && (
              <button className="card-nav budget-edit-btn" onClick={() => setManaging((m) => !m)}>
                {managing ? "done" : "manage"}
              </button>
            )}
          </div>
          {catRings.length === 0 && !managing && (
            <div className="empty-state"><p>No spending logged this month.</p></div>
          )}
          {!managing &&
            catRings.map((r, i) => {
              const overCat = r.budget != null && r.spent > r.budget;
              const color = overCat ? "var(--coral)" : ACCENTS[i % ACCENTS.length];
              const catPct = r.budget ? r.spent / r.budget : 0;
              return (
                <div key={r.id ?? "none"} className="lrow">
                  <Ring pct={catPct} color={color} />
                  <div>
                    <div className="l-name">{r.name}</div>
                    <div className="l-meta">
                      {r.budget != null
                        ? `${fmt0.format(r.spent)} of ${fmt0.format(r.budget)}`
                        : `${fmt0.format(r.spent)} · no budget set`}
                    </div>
                  </div>
                  <span className="l-pct" style={overCat ? { color: "var(--coral)" } : undefined}>
                    {r.budget != null ? `${Math.round(catPct * 100)}%` : ""}
                  </span>
                </div>
              );
            })}
          {managing && (
            <div className="cat-manage">
              {categories.map((c) => (
                <CategoryRow key={c.id} category={c} isPending={isPending} startTransition={startTransition} />
              ))}
              <div className="cat-add-row">
                <input
                  className="quick-add-input"
                  placeholder="new category…"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
                <input
                  className="quick-add-input cat-budget-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="$/mo"
                  value={newCatBudget}
                  onChange={(e) => setNewCatBudget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
                <button className="d-btn" onClick={handleAddCategory} disabled={isPending}>
                  add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trend */}
        <div className="card span-3">
          <div className="card-label"><span>Last 6 months</span></div>
          <div className="trend-bars">
            {trendKeys.map((k, i) => (
              <div key={k} className="trend-col">
                <span className="trend-amount">
                  {trendTotals[i] > 0 ? fmt.format(Math.round(trendTotals[i])).replace(".00", "") : ""}
                </span>
                <div
                  className={`trend-bar${k === monthKey ? " current" : ""}`}
                  style={{ height: `${Math.max((trendTotals[i] / maxTrend) * 100, 2)}%` }}
                />
                <span className="trend-month">{monthLabel(k).slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div className="card span-6">
          <div className="card-label">
            <span>Transactions · {monthLabel(monthKey)}</span>
          </div>
          {monthExpenses.length === 0 ? (
            <div className="empty-state"><p>Nothing logged in {monthLabel(monthKey)} yet.</p></div>
          ) : (
            monthExpenses.map((e) => (
              <div key={e.id} className="expense-item">
                <span className="expense-date">{dayLabel(e.spent_on)}</span>
                <span className="tag-pill">{catName(e.category_id)}</span>
                <span className="expense-note">{e.note}</span>
                <span className="expense-amount">{fmt.format(Number(e.amount))}</span>
                <button
                  className="expense-delete"
                  aria-label="Delete expense"
                  disabled={isPending}
                  onClick={() => startTransition(() => deleteExpense(e.id))}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function CategoryRow({
  category,
  isPending,
  startTransition,
}: {
  category: BudgetCategory;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const [budgetDraft, setBudgetDraft] = useState(
    category.budget != null ? String(Number(category.budget)) : ""
  );

  function save() {
    setEditing(false);
    const name = draft.trim();
    if (!name || name === category.name) return;
    startTransition(() => renameCategory(category.id, name));
  }

  function saveBudget() {
    const amt = parseFloat(budgetDraft);
    const next = amt > 0 ? amt : null;
    const current = category.budget != null ? Number(category.budget) : null;
    if (next === current) return;
    startTransition(() => setCategoryBudget(category.id, next));
  }

  return (
    <div className="cat-manage-row">
      {editing ? (
        <input
          className="inline-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={save}
        />
      ) : (
        <>
          <span className="cat-name">{category.name}</span>
          <input
            className="quick-add-input cat-budget-input"
            type="number"
            min="0"
            step="1"
            placeholder="$/mo"
            value={budgetDraft}
            onChange={(e) => setBudgetDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            onBlur={saveBudget}
          />
          <button className="d-btn" onClick={() => setEditing(true)}>rename</button>
          <button
            className="d-btn danger"
            disabled={isPending}
            onClick={() => startTransition(() => deleteCategory(category.id))}
          >
            delete
          </button>
        </>
      )}
    </div>
  );
}
