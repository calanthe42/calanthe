"use client";

import { useEffect, useState } from "react";

/** Same-day orders close at 14:00 Gulf Standard Time (UTC+4). */
const CUTOFF_HOUR_GST = 14;

function gstNow(): Date {
  /* Read the wall clock in Dubai regardless of the visitor's own zone —
     a customer in London still needs Dubai's cutoff. */
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
}

function remaining(): { open: boolean; h: number; m: number } {
  const now = gstNow();
  const cutoff = new Date(now);
  cutoff.setHours(CUTOFF_HOUR_GST, 0, 0, 0);
  const ms = cutoff.getTime() - now.getTime();
  if (ms <= 0) return { open: false, h: 0, m: 0 };
  return {
    open: true,
    h: Math.floor(ms / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
  };
}

/**
 * The announcement strip, made live: how long is left to order for
 * delivery today. Renders the static line on the server and only
 * swaps in the countdown once mounted, so there is no hydration
 * mismatch and no layout shift — the strip is a fixed height either way.
 */
export function CutoffCountdown() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const { open, h, m } = remaining();
      setLabel(
        open
          ? `Order within ${h > 0 ? `${h}h ` : ""}${m}m for delivery today`
          : "Ordering now for tomorrow's deliveries",
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span suppressHydrationWarning>
      {label ?? "Same-day delivery across the UAE"}
    </span>
  );
}
