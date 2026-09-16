import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  intro?: string;
  /** A fact about what follows — "12 occasions", "24 arrangements". */
  meta?: string;
  /** Anything that belongs on the header's line: a filter, a single link. */
  action?: React.ReactNode;
  className?: string;
};

/**
 * The opening of every inner page — one system, with room for variation.
 *
 * WHAT IT REPLACES. Shop, Occasions, Events, Account and Wishlist each
 * repeated the same block by hand: an eyebrow, a headline and an intro,
 * all inside `max-w-2xl` at the top-left of an otherwise empty page. On a
 * 1440px screen that put every word in the left 40% and left 60% blank, on
 * every page, in the same shape — the most template-like thing on the site,
 * and the reason the inner pages read as copies of one another.
 *
 * WHAT IT DOES INSTEAD. The eyebrow moves into a narrow left rail, the way
 * a margin note sits beside body text in a printed page, and the headline
 * and intro take the main column. A hairline closes the header across the
 * FULL width, which is what actually resolves the empty right-hand side:
 * the rule says the page is this wide, so the whitespace becomes deliberate
 * margin instead of an unfinished layout. `meta` and `action` can occupy
 * that far end when a page has something true to put there.
 *
 * Variation is built in and bounded — a page chooses whether it carries a
 * count, or an action, or neither. Nobody hand-rolls the block again.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  meta,
  action,
  className,
}: PageHeaderProps) {
  return (
    <Reveal
      className={cn(
        "mb-10 border-b border-hairline pb-8 lg:mb-14 lg:pb-10",
        className,
      )}
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] lg:gap-10">
        {/* The rail. On a phone it is simply the line above the headline. */}
        <div className="lg:pt-2">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>

        <div className="mt-3 lg:mt-0">
          <h1 className="display-2 font-display font-light text-olive">{title}</h1>

          {(intro || meta || action) && (
            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
              {intro && (
                <p className="max-w-lg text-base leading-relaxed text-ink-muted">
                  {intro}
                </p>
              )}
              {(meta || action) && (
                <div className="flex shrink-0 items-center gap-6 lg:pb-1">
                  {meta && (
                    <p className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted">
                      {meta}
                    </p>
                  )}
                  {action}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}
