"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tabs — the WAI-ARIA pattern.
 *
 * One tab stop for the whole list; the arrow keys move between tabs (and
 * follow reading direction, so → means "next" in English and ← in Arabic);
 * Home and End jump. Panels are server-rendered content handed in as props, so
 * switching tabs costs no request.
 */

export type TabItem = { value: string; label: string; badge?: string | number; content: ReactNode };

export function Tabs({
  label,
  tabs,
  defaultValue,
}: {
  label: string;
  tabs: readonly TabItem[];
  defaultValue?: string;
}) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value ?? "");
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const index = tabs.findIndex((tab) => tab.value === active);
    let next: number;
    if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (index + 1) % tabs.length;
    else if (event.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;

    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    setActive(target.value);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div className="min-w-0">
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="admin-scroll-x flex gap-1 border-b border-line"
      >
        {tabs.map((tab) => {
          const selected = tab.value === active;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.value)}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                selected ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              {tab.label}
              {tab.badge !== undefined ? (
                <span className="rounded-sm bg-sunken px-1.5 text-xs text-ink-2 tabular">{tab.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.value}
          role="tabpanel"
          id={`${baseId}-panel-${tab.value}`}
          aria-labelledby={`${baseId}-tab-${tab.value}`}
          hidden={tab.value !== active}
          tabIndex={0}
          className="pt-5"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
