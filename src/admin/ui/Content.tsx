import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { servedMediaPath } from "@backend/domain/media-option";
import { Icon } from "./icons";

/**
 * Small pieces for showing records: detail lists, thumbnails, form sections.
 */

/** A definition list that simply leaves out what was never filled in. */
export function DescriptionList({
  rows,
  emptyLabel,
  columns = 2,
}: {
  rows: readonly (readonly [string, ReactNode | null | undefined])[];
  emptyLabel: string;
  columns?: 1 | 2;
}) {
  const present = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (present.length === 0) return <p className="text-sm text-ink-3">{emptyLabel}</p>;
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", columns === 2 && "sm:grid-cols-2")}>
      {present.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-ink-3">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Thumb({
  src,
  alt,
  shape = "portrait",
  className,
}: {
  src?: string | null;
  alt?: string | null;
  shape?: "portrait" | "square";
  className?: string;
}) {
  const path = servedMediaPath(src);
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-md border border-line bg-sunken",
        shape === "portrait" ? "h-14 w-11" : "h-12 w-12",
        className,
      )}
    >
      {path ? (
        <Image src={path} alt={alt ?? ""} fill sizes="56px" className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-ink-3/70">
          <Icon name="photoOff" className="h-4 w-4" />
        </span>
      )}
    </span>
  );
}

/**
 * A titled group of fields.
 *
 * `id` is required: it ties the section to its heading for assistive
 * technology (Server Components cannot generate one).
 */
export function FormSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("min-w-0 scroll-mt-24 rounded-md border border-line bg-surface shadow-card", className)}
    >
      <header className="border-b border-line px-4 py-4 sm:px-5">
        <h2 id={`${id}-title`} className="text-[15px] font-semibold text-ink">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm leading-relaxed text-ink-3">{description}</p> : null}
      </header>
      <div className="grid gap-5 px-4 py-5 sm:px-5">{children}</div>
    </section>
  );
}
