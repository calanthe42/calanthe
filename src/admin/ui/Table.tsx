import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The data table.
 *
 * A real <table> from 768px, with a caption and column headers a screen
 * reader can navigate. Below 768px each row becomes a card (see admin.css,
 * `.a-table`): the primary cell is the title, the others are label/value
 * lines, the actions sit along the bottom. Nothing scrolls sideways on a
 * phone, and the Edit button is never the part that falls off-screen.
 *
 * Every cell after the first needs `label` — it is what the phone layout shows
 * beside the value.
 */

export type Column = {
  key: string;
  label: string;
  align?: "start" | "end";
  /** Visually hidden heading, e.g. for the actions column. */
  hidden?: boolean;
  className?: string;
};

export function Table({
  caption,
  columns,
  children,
  className,
}: {
  caption: string;
  columns: readonly Column[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-card", className)}>
      <div className="md:overflow-x-auto">
        <table role="table" className="a-table w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-line bg-sunken/60">
            <tr role="row">
              {columns.map((column) => (
                <th
                  key={column.key}
                  role="columnheader"
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-xs font-medium text-ink-3",
                    column.align === "end" ? "text-end" : "text-start",
                    column.className,
                  )}
                >
                  {column.hidden ? <span className="sr-only">{column.label}</span> : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr role="row" className={cn("transition-colors duration-150 md:border-t md:border-line md:first:border-t-0 md:hover:bg-hover", className)}>
      {children}
    </tr>
  );
}

export function Td({
  children,
  label,
  primary = false,
  actions = false,
  align = "start",
  hideOnMobile = false,
  className,
}: {
  children?: ReactNode;
  label?: string;
  primary?: boolean;
  actions?: boolean;
  align?: "start" | "end";
  hideOnMobile?: boolean;
  className?: string;
}) {
  return (
    <td
      role="cell"
      data-label={label}
      data-primary={primary || undefined}
      data-actions={actions || undefined}
      data-hide-mobile={hideOnMobile || undefined}
      className={cn(
        "px-4 py-3 align-middle text-ink",
        align === "end" ? "md:text-end" : "text-start",
        actions && "md:w-px md:whitespace-nowrap",
        className,
      )}
    >
      {actions ? <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">{children}</div> : children}
    </td>
  );
}
