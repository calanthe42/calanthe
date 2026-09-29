import { cn } from "@/lib/cn";

type LogotypeProps = {
  className?: string;
};

/**
 * Text logotype set in Cinzel to match the brand wordmark
 * (Calanthe_Final Files/PNG/Typeface_*). Rendering as text keeps it
 * crisp at every size and costs nothing on the wire.
 */
export function Logotype({ className }: LogotypeProps) {
  return (
    /* lang="en": the name is Latin even on an Arabic page, so it keeps its
       tracking when Arabic brand type loses it (see globals.css). */
    <span
      lang="en"
      className={cn(
        "font-brand text-xl font-medium uppercase tracking-[0.22em] text-olive",
        className,
      )}
    >
      Calanthe
    </span>
  );
}
