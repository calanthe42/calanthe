import { CircularCarousel } from "@/components/motion/CircularCarousel";
import { getDictionary } from "@/lib/i18n/server";

/**
 * THE DETAILS, AS THE IDENTITY BOOK PHOTOGRAPHS THEM — the four pictures of
 * the deck's page 14 (printed ribbon, the olive hang tag, the cream hang
 * tag, the paper wrap and sticker) on a turning ring.
 *
 * The ring steps one card forward every few seconds and settles on a
 * critically damped spring; a finger or a mouse can throw it; it rests
 * while a pointer is over it. The cards are portraits, like the deck's
 * tiles, and the far ones fade into the section's cream, so the ring sits
 * in the page rather than on it.
 *
 * Sized for a phone first. The component shrinks the whole ring to fit its
 * container's width, which on a 390px screen left the front card small and
 * the frame mostly empty. So on phones the container is wider than the
 * screen and the section crops it: the front card is large and centred,
 * the two neighbours run off the edges — the peek the brand's product rows
 * use. From a laptop up the ring fits the content width whole, with the
 * front card at 380px and the frame no taller than the card and its
 * caption need.
 */
export async function PackagingGallery() {
  const { t } = await getDictionary();
  const g = t.about.gallery;
  const items = [
    {
      src: "/brand/gallery/ribbon.webp",
      alt: g.ribbon.alt,
      title: g.ribbon.title,
      subtitle: g.ribbon.subtitle,
    },
    {
      src: "/brand/gallery/tag-olive.webp",
      alt: g.tagOlive.alt,
      title: g.tagOlive.title,
      subtitle: g.tagOlive.subtitle,
    },
    {
      src: "/brand/gallery/tag-cream.webp",
      alt: g.tagCream.alt,
      title: g.tagCream.title,
      subtitle: g.tagCream.subtitle,
    },
    {
      src: "/brand/gallery/paper-wrap.webp",
      alt: g.paperWrap.alt,
      title: g.paperWrap.title,
      subtitle: g.paperWrap.subtitle,
    },
  ];

  return (
    <div className="relative -mx-[clamp(1.25rem,3vw,2rem)] overflow-hidden sm:mx-0">
      <div className="relative -ms-[32.5%] h-[26rem] w-[165%] font-sans text-olive sm:ms-0 sm:h-[30rem] sm:w-full lg:h-[42rem]">
        <CircularCarousel
          items={items}
          label={g.label}
          preset="orbit"
          /* Straight on: no camera tilt, so every photograph is seen square,
             not from above. */
          tilt={0}
          intro="rise"
          autoplay="step"
          interval={3.6}
          cardWidth={380}
          aspectRatio={0.75}
          gap={0}
          momentum={0.5}
          parallax={0.1}
          stretch={0}
          depthFade={0.5}
          fadeColor="#E4DCC5"
          cornerRadius={12}
          captions
        />
      </div>
    </div>
  );
}
