import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FloralImage } from "@/components/ui/FloralImage";
import { CONTACT, PRODUCT_PHOTOS } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

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
export async function CatalogueEmpty({
  title,
  message,
  eyebrow,
}: {
  title?: string;
  message?: string;
  eyebrow?: string;
}) {
  const { t } = await getDictionary();
  /* Callers may pass their own wording (an occasion page names the occasion);
     otherwise the dictionary speaks, in the visitor's language. */
  const heading = title ?? t.empty.title;
  const body = message ?? t.empty.body;
  const label = eyebrow ?? t.empty.eyebrow;
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
          /* While the catalogue is empty this photograph IS the shop page's
             largest paint — Next reported it as the LCP element and asked
             for the hint. */
          priority
        />
      </ClipReveal>

      <Reveal className="max-w-md">
        <Eyebrow>{label}</Eyebrow>
        <h2 className="mt-3 font-display text-3xl font-light leading-tight text-olive lg:text-[2.75rem]">
          {heading}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">{body}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/build-your-own" className="whitespace-nowrap">
            {t.nav.buildYourOwn}
          </ButtonLink>
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("secondary", "whitespace-nowrap")}
          >
            {t.empty.messageFlorist}
          </a>
        </div>
      </Reveal>
    </div>
  );
}
