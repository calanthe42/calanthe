import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";

/**
 * Shown when the catalogue itself has nothing to show — as opposed to
 * ShopGrid's message, which means "your filters excluded everything".
 *
 * The two are genuinely different: one is the customer's doing and is fixed by
 * changing a filter; this one is ours, and telling someone to soften a filter
 * they never set is worse than saying nothing. Written in the brand's own
 * voice rather than as a developer's empty state.
 */
export function CatalogueEmpty({
  title = "The atelier is between collections.",
  message = "New arrangements are being composed. Do come back shortly — or write to us and we will make something for you.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-media border border-hairline bg-cream/40 px-6 py-16 text-center">
      <Monogram className="w-10 text-sage/70" />
      <Eyebrow className="text-sage">Coming soon</Eyebrow>
      <h2 className="max-w-md font-display text-2xl font-light text-olive lg:text-3xl">
        {title}
      </h2>
      <p className="max-w-sm text-base leading-relaxed text-sage">{message}</p>
    </div>
  );
}
