import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FloralImage } from "@/components/ui/FloralImage";
import { CONTACT, PRODUCT_PHOTOS } from "@/lib/data";

/**
 * Shown when the catalogue itself has nothing to show — as opposed to
 * ShopGrid's message, which means "your filters excluded everything".
 *
 * The two are genuinely different: one is the customer's doing and is fixed by
 * changing a filter; this one is ours, and telling someone to soften a filter
 * they never set is worse than saying nothing.
 *
 * AN EMPTY SHELF IS NOT A CLOSED SHOP. The atelier composes to order, so this
 * never ends at "come back later": it offers the two ways to order that need
 * no catalogue — a bespoke arrangement, or a florist on WhatsApp. It is laid
 * out as an editorial moment (photograph beside the words) rather than a boxed
 * notice, because on a quiet week it may be the first thing a visitor sees.
 */
export function CatalogueEmpty({
  title = "Every arrangement can be made to order.",
  message = "The next collection is being composed. Until it arrives, tell us the moment, the colours and your budget, and a florist will compose it for you.",
  eyebrow = "Made to order",
}: {
  title?: string;
  message?: string;
  eyebrow?: string;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <ClipReveal className="relative aspect-[4/3] w-full overflow-hidden rounded-media lg:aspect-[5/6]">
        <FloralImage
          image={{
            alt: "A white rose arrangement",
            src: PRODUCT_PHOTOS.softWhiteRose,
            placeholder: { seed: "catalogue-empty", palette: "warm" },
          }}
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </ClipReveal>

      <Reveal className="max-w-md">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-3 font-display text-3xl font-light leading-tight text-olive lg:text-[2.75rem]">
          {title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-sage">{message}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/build-your-own" className="whitespace-nowrap">
            Build Your Own
          </ButtonLink>
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("secondary", "whitespace-nowrap")}
          >
            Message a Florist
          </a>
        </div>
      </Reveal>
    </div>
  );
}
