import Link from "next/link";
import { cn } from "@/lib/cn";
import { Input } from "./Field";

/**
 * Choosing a time range.
 *
 * Presets are links (the range lives in the URL, so the dashboard can be
 * bookmarked at "30 days"). The from/to pair is two native date inputs inside
 * a filter form — the device's own calendar, in the device's own language.
 */

export type RangePreset = { label: string; href: string; active: boolean; description?: string };

export function DateRangePresets({ label, presets }: { label: string; presets: readonly RangePreset[] }) {
  return (
    <nav aria-label={label}>
      <ul className="inline-flex rounded-md border border-line bg-surface p-1 shadow-card">
        {presets.map((preset) => (
          <li key={preset.href}>
            <Link
              href={preset.href}
              aria-current={preset.active ? "true" : undefined}
              title={preset.description}
              className={cn(
                "inline-flex min-h-10 min-w-14 items-center justify-center whitespace-nowrap rounded-sm px-3 text-sm font-medium transition-colors duration-150 sm:min-h-8",
                preset.active ? "bg-ink text-page" : "text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              {preset.label}
              {preset.description ? <span className="sr-only"> — {preset.description}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DateRangeFields({
  legend,
  from,
  to,
}: {
  legend: string;
  from: { name: string; value: string; label: string };
  to: { name: string; value: string; label: string };
}) {
  return (
    <fieldset className="min-w-0 sm:col-span-2">
      <legend className="mb-1.5 text-xs font-medium text-ink-2">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Input id={`range-${from.name}`} name={from.name} type="date" defaultValue={from.value} aria-label={from.label} />
        <Input id={`range-${to.name}`} name={to.name} type="date" defaultValue={to.value} aria-label={to.label} />
      </div>
    </fieldset>
  );
}
