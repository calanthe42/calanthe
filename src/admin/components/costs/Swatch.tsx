import { cn } from "@/lib/cn";

/**
 * The small colour dot beside a flower's name, so a peach ranunculus is easy
 * to find in a list of thirty roses.
 *
 * The colour is the owner's own data (`#rrggbb`, checked by parseSwatch), not
 * a design colour, which is why it is the one inline style here. Without one
 * the dot is an empty ring, so every row keeps the same rhythm.
 */
export function Swatch({ color, className }: { color: string | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong", !color && "bg-sunken", className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
