import type { Metadata } from "next";
import Image from "next/image";
import { getDictionary } from "@/lib/i18n/server";
import { CONTACT } from "@/lib/data";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { HairlineDraw } from "@/components/motion/HairlineDraw";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { Reveal } from "@/components/motion/Reveal";
import { SplitLines } from "@/components/motion/SplitLines";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { PackagingTrio } from "@/components/blocks/PackagingTrio";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FloralImage } from "@/components/ui/FloralImage";
import { Logotype } from "@/components/ui/Logotype";
import { Monogram } from "@/components/ui/Monogram";
import { OrchidPrint } from "@/components/ui/OrchidPrint";
import { StackedLogo } from "@/components/ui/StackedLogo";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    description:
      "Calanthe is an Abu Dhabi-based floral brand created around the art of thoughtful giving — the name, the mark, the colours and the packaging, and what every order includes.",
    title: t.meta.about,
  };
}

/*
 * The client's six services (portfolio, p.3), in the order she gave them.
 * The words are in the dictionary; this is only the running order, which is
 * client-approved and must not change.
 */
const SERVICE_ORDER = [
  "signature",
  "bespoke",
  "events",
  "memberships",
  "gifting",
  "corporate",
] as const;

/**
 * THE PALETTE, as the identity book names it (p.12). The chip is the colour
 * itself; the words sit under it on the page, never on it, because the only
 * pairings the brand allows are cream on olive, olive on cream and cream on
 * burgundy. The chips are modest on purpose: burnt orange is an accent and
 * is never a large fill, and a swatch should not become one.
 */
const PALETTE = [
  { key: "olive", chip: "bg-olive", edge: "after:border-cream/15" },
  { key: "sage", chip: "bg-sage", edge: "after:border-olive/15" },
  { key: "burgundy", chip: "bg-burgundy", edge: "after:border-cream/15" },
  { key: "orange", chip: "bg-burnt-orange", edge: "after:border-olive/15" },
  { key: "cream", chip: "bg-cream", edge: "after:border-olive/15" },
] as const;

/**
 * THE ABOUT PAGE — the identity book, turned into a page.
 *
 * Everything on it comes from the client's own brand book: the name and
 * what it means, the belief, the services, the mark and its three settings,
 * the five colours and where each belongs, the packaging a customer holds
 * and the three ways the orchid is drawn on it, the promise kept on every
 * order, and how to reach the atelier. Nothing is invented and nothing is
 * stock.
 *
 * THE GROUNDS ALTERNATE so eleven sections never read as one slab:
 * burgundy, canvas, cream, canvas (print), cream, canvas, cream, canvas,
 * olive (print), canvas, olive. Burgundy opens because it is the brand's
 * intimate register; olive closes because the page ends on its signature.
 *
 * Designed at 390px first. Every grid is one column on a phone; the palette
 * is the one horizontal row, scroll-snapped with a peek, the way the brand
 * shows a row of products.
 */
export default async function AboutPage() {
  const { t } = await getDictionary();
  const promises = [
    { title: t.trust.freshTitle, copy: t.trust.freshCopy },
    { title: t.trust.videoTitle, copy: t.trust.videoCopy },
    { title: t.trust.sameDayTitle, copy: t.trust.sameDayCopy },
    { title: t.trust.emiratesTitle, copy: t.trust.emiratesCopy },
  ];
  const treatments = [
    { ...t.about.treatments.bags, src: "/brand/bag-pattern.webp", alt: t.alt.bagPattern },
    { ...t.about.treatments.cards, src: "/brand/card-front.webp", alt: t.alt.cardFront },
    { ...t.about.treatments.tags, src: "/brand/tags-trio.webp", alt: t.alt.tagsTrio },
  ];
  const reach = [
    { label: t.footer.whatsapp, value: CONTACT.whatsapp, href: CONTACT.whatsappHref },
    { label: t.footer.instagram, value: CONTACT.instagramHandle, href: CONTACT.instagramHref },
    { label: t.footer.email, value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  ];

  return (
    <main>
      {/* 1 · OPENING — burgundy, the brand's intimate register. */}
      <section className="relative overflow-hidden bg-burgundy section-pad">
        <Monogram className="pointer-events-none absolute -right-[18%] -top-[26%] w-[68%] text-cream/[0.035] lg:-right-[8%] lg:w-[34%]" />
        <div className="relative mx-auto max-w-7xl gutter">
          <div className="mx-auto max-w-3xl text-center">
            <MonogramBloom className="mx-auto w-12 text-burnt-orange" />
            <Eyebrow className="mt-6 text-cream/60">{t.about.eyebrow}</Eyebrow>
            <SplitLines
              as="h1"
              lines={[t.about.title]}
              className="mt-3 font-display text-[clamp(2.5rem,7vw,4rem)] font-light leading-[1.05] text-cream"
            />
            <Reveal delay={0.15}>
              <p className="mt-8 text-lg leading-relaxed text-cream/85">{t.about.intro}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 2 · THE BELIEF — the words, and the flowers answering beside them. */}
      <section className="section-pad">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 gutter lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <Eyebrow>{t.about.beliefEyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">{t.about.beliefTitle}</h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">{t.about.beliefBody1}</p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">{t.about.beliefBody2}</p>
            {/* The book's three keywords, as one quiet line rather than three
                labelled columns. */}
            <HairlineDraw className="mt-8 max-w-md" />
            <p className="mt-6 font-display text-2xl font-light italic text-olive lg:text-3xl">
              {t.about.beliefWords}
            </p>
          </Reveal>

          <ClipReveal className="relative aspect-[4/5] w-full overflow-hidden rounded-media shadow-soft">
            <FloralImage
              image={{
                alt: t.alt.aboutBag,
                src: "/brand/packaging-curtain.webp",
                placeholder: { seed: "about-atelier", palette: "burgundy" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
              quality={90}
            />
          </ClipReveal>
        </div>
      </section>

      {/* 3 · WHAT WE DO — the client's six, as an editorial index, not cards. */}
      <section className="bg-cream section-pad">
        <div className="mx-auto max-w-7xl gutter">
          <Reveal className="text-center">
            <Eyebrow>{t.about.servicesEyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">{t.about.servicesTitle}</h2>
          </Reveal>

          <Stagger className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
            {SERVICE_ORDER.map((id) => (
              <StaggerItem key={id}>
                <div className="border-t border-hairline pt-5">
                  <h3 className="font-display text-2xl font-light text-olive">{t.about.services[id].name}</h3>
                  <p className="mt-3 text-base leading-relaxed text-ink-muted">{t.about.services[id].copy}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 4 · THE NAME — Calanthe is an orchid, and the word is Greek. */}
      <section className="relative isolate overflow-hidden section-pad">
        <OrchidPrint ground="canvas" />

        <div className="mx-auto grid max-w-7xl gutter gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-20">
          <ClipReveal className="relative aspect-[3/4] w-full overflow-hidden rounded-media shadow-soft lg:order-2">
            <FloralImage
              image={{
                alt: t.alt.aboutOrchid,
                src: "/brand/orchid-buds.webp",
                placeholder: { seed: "about-name", palette: "olive" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
              quality={90}
            />
          </ClipReveal>

          <div className="lg:order-1">
            <Reveal>
              <Eyebrow>{t.about.nameEyebrow}</Eyebrow>
            </Reveal>
            <SplitLines
              as="h2"
              lines={[t.about.nameLine1, t.about.nameLine2]}
              className="display-2 mt-4 font-display font-light italic text-olive"
            />
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">{t.about.nameBody}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/*
        5 · THE MARK — the symbol, and its three settings, as the client's
        own vector artwork.

        The signature is set the way it sits on the bag: cream on deep olive,
        over the orchid print, and it is the largest thing in the section.
        The seal and the name are two smaller panels beside it. Asymmetric
        on a laptop (one tall panel, two square ones), stacked on a phone.
        No photograph here: a bitmap of the mark could only be softer than
        the mark itself.
      */}
      <section className="bg-cream section-pad">
        <div className="mx-auto max-w-7xl gutter">
          <Reveal className="max-w-xl">
            <Eyebrow>{t.about.mark.eyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">{t.about.mark.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              {/* The "C" is one glyph in the brand face, dropped into the
                  sentence so the sentence owns the slot (and survives
                  translation whole). */}
              {t.about.monogramNote.split("{letter}").map((part, i) => (
                <span key={i}>
                  {i > 0 && (
                    <span lang="en" className="font-brand text-olive">
                      C
                    </span>
                  )}
                  {part}
                </span>
              ))}{" "}
              {t.about.mark.pressed}
            </p>
          </Reveal>

          <Stagger className="mt-10 grid grid-cols-1 gap-8 lg:mt-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-2 lg:gap-x-8 lg:gap-y-10">
            {/* The signature — as on the bag. */}
            <StaggerItem className="flex flex-col lg:row-span-2">
              <div className="relative isolate flex aspect-[4/5] w-full flex-1 items-center justify-center overflow-hidden rounded-media bg-olive shadow-soft lg:aspect-auto">
                <OrchidPrint ground="olive" className="opacity-70" />
                <StackedLogo tone="cream" defineSymbol={false} className="w-[58%] max-w-[22rem]" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-light text-olive">{t.about.mark.stackedName}</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-ink-muted">{t.about.mark.stackedUse}</p>
            </StaggerItem>

            {/* The seal — the symbol alone, in the accent, on the page's paper. */}
            <StaggerItem className="flex flex-col">
              <div className="relative isolate flex aspect-[16/10] w-full flex-1 items-center justify-center overflow-hidden rounded-media border border-hairline bg-canvas lg:aspect-auto">
                <OrchidPrint ground="canvas" />
                <Monogram className="w-[26%] max-w-[7rem] text-burnt-orange" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-light text-olive">{t.about.mark.monogramName}</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-ink-muted">{t.about.mark.monogramUse}</p>
            </StaggerItem>

            {/* The name — the wordmark on its own. */}
            <StaggerItem className="flex flex-col">
              <div className="flex aspect-[16/10] w-full flex-1 items-center justify-center overflow-hidden rounded-media border border-hairline bg-canvas lg:aspect-auto">
                <Logotype className="text-[clamp(1.5rem,4.2vw,2.25rem)]" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-light text-olive">{t.about.mark.logotypeName}</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-ink-muted">{t.about.mark.logotypeUse}</p>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/*
        6 · THE PALETTE — five colours, each with its place.

        A horizontal, snapped row on a phone (two chips and a peek, like a
        row of products); five columns from a laptop up.
      */}
      <section className="section-pad">
        <div className="mx-auto max-w-7xl lg:gutter">
          <Reveal className="max-w-xl gutter lg:px-0">
            <Eyebrow>{t.about.palette.eyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">{t.about.palette.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">{t.about.palette.body}</p>
          </Reveal>

          <Stagger className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 lg:mt-14 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:px-0">
            {PALETTE.map((swatch) => (
              <StaggerItem key={swatch.key} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-auto">
                <div
                  aria-hidden
                  className={`relative aspect-[4/5] w-full rounded-sm border border-hairline ${swatch.chip} after:pointer-events-none after:absolute after:inset-2 after:rounded-[2px] after:border ${swatch.edge} after:content-['']`}
                />
                <h3 className="mt-4 font-brand text-xs font-medium uppercase tracking-brand text-olive">
                  {t.about.palette[swatch.key].name}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-ink-muted">{t.about.palette[swatch.key].use}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/*
        7 · THE PACKAGING — the three pieces standing together, then the
        details a customer holds. The pictures are the identity book's own,
        cut with its own masks, at full resolution.
      */}
      <section className="bg-cream section-pad">
        <div className="mx-auto max-w-7xl gutter">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-end lg:gap-20">
            <Reveal>
              <Eyebrow>{t.about.packaging.eyebrow}</Eyebrow>
              <h2 className="display-2 mt-3 font-display font-light text-olive">{t.about.packaging.title}</h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">{t.about.packaging.body}</p>
            </Reveal>
            <PackagingTrio />
          </div>

          <HairlineDraw className="mt-14 lg:mt-20" />

          <Reveal className="mt-10 max-w-xl">
            <Eyebrow>{t.about.detailsEyebrow}</Eyebrow>
            <h3 className="mt-3 font-display text-3xl font-light text-olive">{t.about.detailsTitle}</h3>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">{t.about.detailsBody}</p>
          </Reveal>

          <Stagger className="mt-10 grid grid-cols-2 gap-4 lg:mt-14 lg:grid-cols-4 lg:gap-6">
            {[
              { src: "/brand/about-bag.webp", alt: t.alt.aboutBagTile, label: t.alt.labelBag },
              { src: "/brand/about-sleeve.webp", alt: t.alt.aboutSleeve, label: t.alt.labelSleeve },
              { src: "/brand/hang-tag.webp", alt: t.alt.aboutTag, label: t.alt.labelTag },
              { src: "/brand/cards-debossed.webp", alt: t.alt.aboutCard, label: t.alt.labelCard },
            ].map((item) => (
              <StaggerItem key={item.src}>
                <figure>
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-media">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 1024px) 46vw, 23vw"
                      quality={90}
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="mt-3 font-brand text-[0.625rem] uppercase tracking-brand text-ink-muted">
                    {item.label}
                  </figcaption>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 8 · ONE FLOWER, THREE WAYS — how the orchid is drawn on each piece. */}
      <section className="section-pad">
        <div className="mx-auto max-w-7xl gutter">
          <Reveal className="max-w-xl">
            <Eyebrow>{t.about.treatments.eyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">{t.about.treatments.title}</h2>
          </Reveal>

          <Stagger className="mt-10 grid grid-cols-1 gap-10 lg:mt-14 lg:grid-cols-3 lg:gap-8">
            {treatments.map((item) => (
              <StaggerItem key={item.src}>
                <ClipReveal className="relative aspect-[4/3] w-full overflow-hidden rounded-media shadow-soft">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 1024px) 92vw, 30vw"
                    quality={90}
                    className="object-cover"
                  />
                </ClipReveal>
                <h3 className="mt-5 font-display text-2xl font-light text-olive">{item.name}</h3>
                <p className="mt-2 max-w-md text-base leading-relaxed text-ink-muted">{item.copy}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 9 · IN PRACTICE — the promise, on olive, printed on the brand's paper. */}
      <section className="relative isolate overflow-hidden bg-olive section-pad">
        <OrchidPrint ground="olive" className="opacity-60" />
        <div className="relative mx-auto grid max-w-7xl gap-10 gutter lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Reveal>
            <Eyebrow className="text-cream/60">{t.about.practice.eyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-cream">{t.about.practice.title}</h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-cream-muted">{t.about.practice.body}</p>
          </Reveal>

          <Stagger className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
            {promises.map((item) => (
              <StaggerItem key={item.title} className="flex items-start gap-4 border-t border-cream/20 py-6">
                <Monogram className="mt-1.5 w-4 shrink-0 text-burnt-orange" />
                <div>
                  <h3 className="font-display text-2xl font-light text-cream">{item.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-cream-muted">{item.copy}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 10 · WHERE WE ARE — three ways to reach the atelier, each a full-width tap. */}
      <section className="section-pad">
        <div className="mx-auto grid max-w-7xl gap-10 gutter lg:grid-cols-2 lg:items-center lg:gap-20">
          <Reveal>
            <Eyebrow>{t.about.find.eyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">{t.about.find.title}</h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">{t.about.find.body}</p>
          </Reveal>

          <Stagger className="flex flex-col border-b border-hairline">
            {reach.map((row) => (
              <StaggerItem key={row.href}>
                <a
                  href={row.href}
                  target={row.href.startsWith("http") ? "_blank" : undefined}
                  rel={row.href.startsWith("http") ? "noreferrer" : undefined}
                  className="flex min-h-14 items-center justify-between gap-6 border-t border-hairline py-4 transition-opacity duration-200 ease-bloom hover:opacity-70"
                >
                  <span className="font-brand text-xs font-medium uppercase tracking-brand text-ink-muted">
                    {row.label}
                  </span>
                  <span dir="ltr" className="truncate font-sans text-base text-olive">
                    {row.value}
                  </span>
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 11 · CLOSE — the line the whole brand rests on. */}
      <section className="relative overflow-hidden bg-olive section-pad">
        <div className="relative mx-auto max-w-7xl gutter text-center">
          <ClipReveal className="mx-auto mb-12 aspect-[4/5] w-full max-w-sm overflow-hidden rounded-media">
            <FloralImage
              image={{
                alt: t.alt.aboutBloom,
                src: "/brand/keyvisual-bloom.webp",
                placeholder: { seed: "about-close", palette: "burgundy" },
              }}
              sizes="(max-width: 640px) 92vw, 24rem"
              quality={90}
            />
          </ClipReveal>
          <SplitLines
            as="p"
            lines={[t.about.closingLine]}
            className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-light italic text-cream"
          />
          <Reveal delay={0.15}>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/shop" variant="primary">
                {t.cart.shopFlowers}
              </ButtonLink>
              <ButtonLink href="/build-your-own" variant="secondary-cream">
                {t.cart.buildYourOwn}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
