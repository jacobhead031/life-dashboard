"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveHomeOrder } from "@/app/actions";

export type HomeSlot = { id: string; span: 2 | 3 | 4 | 6; href?: string; node: React.ReactNode };

// A click on any of these inside a card is that control's own business, not "open the page".
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="checkbox"], [role="button"], [role="radio"], .add-panel';

// Saved order first; cards the saved order doesn't know (new ones) keep their default place after it.
export function applyOrder(defaults: string[], saved: string[]): string[] {
  const known = saved.filter((id) => defaults.includes(id));
  return [...known, ...defaults.filter((id) => !known.includes(id))];
}

function Slot({ slot, arranging }: { slot: HomeSlot; arranging: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id, disabled: !arranging });
  const href = arranging ? undefined : slot.href;
  return (
    <div
      ref={setNodeRef}
      className={`bento-slot span-${slot.span}${arranging ? " arranging" : ""}${href ? " linked" : ""}`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        ...(isDragging ? { zIndex: 2, opacity: 0.85 } : {}),
      }}
      {...(arranging ? { ...attributes, ...listeners } : {})}
      onClick={href ? (e) => {
        if ((e.target as HTMLElement).closest(INTERACTIVE) || window.getSelection()?.toString()) return;
        // Mid-edit in this card (page number, add form): the click is just "click away", not "open".
        if (e.currentTarget.contains(document.activeElement) && document.activeElement?.matches("input, textarea, select")) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      } : undefined}
    >
      {slot.node}
    </div>
  );
}

export function HomeGrid({ slots, order }: { slots: HomeSlot[]; order: string[] }) {
  const [arranging, setArranging] = useState(false);
  // Moving a card's DOM node restarts its entrance animation, so it is switched off once arranging has begun.
  const [settled, setSettled] = useState(false);
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(order, (_, next: string[]) => next);
  const ids = applyOrder(slots.map((s) => s.id), saved);
  // Mouse needs 5px of travel; touch is a long-press so the page still scrolls while arranging.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function save(next: string[]) {
    startTransition(async () => {
      setSaved(next);
      await saveHomeOrder(next);
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) save(arrayMove(ids, from, to));
  }

  return (
    <>
      <div className="arrange-bar">
        {arranging && <span className="arrange-hint">drag cards into the order you want</span>}
        {arranging && saved.length > 0 && <button className="d-btn" onClick={() => save([])}>reset</button>}
        <button className="d-btn" aria-pressed={arranging} onClick={() => { setSettled(true); setArranging((v) => !v); }}>
          {arranging ? "✓ done" : "⠿ arrange"}
        </button>
      </div>
      <DndContext id="home-grid-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className={`grid-bento${settled ? " settled" : ""}`}>
            {ids.map((id) => {
              const slot = slots.find((s) => s.id === id)!;
              return <Slot key={id} slot={slot} arranging={arranging} />;
            })}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}
