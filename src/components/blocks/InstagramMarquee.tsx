import { Monogram } from "@/components/ui/Monogram";
import { CONTACT } from "@/lib/data";
import { cn } from "@/lib/cn";

/**
 * The Instagram invitation — set in type, not in borrowed photographs.
 *
 * This section used to be two rows of stock CGI imagery captioned "Calanthe on
 * Instagram". None of it was Calanthe's, and a visitor who followed the link
 * expecting those pictures would find a different feed. Until the atelier's
 * own posts can be shown, the rows carry what is true — the handle and the
 * invitation — in the same CSS marquee grammar the client approved (two rows,
 * opposite directions, pause on hover). The words are decorative and hidden
 * from assistive technology; the one link below is the real content.
 */

const PHRASES = {
  handle: CONTACT.instagramHandle,
  invitation: "Follow the atelier",
} as const;

function MarqueeRow({
  phrase,
  reverse = false,
  className,
}: {
  phrase: string;
  reverse?: boolean;
  className?: string;
}) {
  /* One run repeated enough to overfill the widest screen, then doubled so
     the track can translate -50% into a seamless loop. */
  const run = Array.from({ length: 6 }, () => phrase);
  const doubled = [...run, ...run];

  return (
    <div className={cn("group overflow-hidden", className)} aria-hidden>
      <div
        className={cn(
          "marquee-track flex w-max items-center",
          reverse && "marquee-reverse",
        )}
      >
        {doubled.map((text, i) => (
          <span key={i} className="flex shrink-0 items-center">
            <span className="whitespace-nowrap px-6 font-display text-5xl font-light leading-none text-olive lg:px-10 lg:text-7xl">
              {text}
            </span>
            <Monogram className="h-6 w-6 shrink-0 text-burnt-orange/60 lg:h-8 lg:w-8" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function InstagramMarquee() {
  return (
    <section className="overflow-hidden section-pad">
      <div className="flex flex-col gap-4 lg:gap-6">
        <MarqueeRow phrase={PHRASES.handle} />
        <MarqueeRow
          phrase={PHRASES.invitation}
          reverse
          className="hidden italic text-sage sm:block [&_span]:text-sage"
        />
      </div>

      <div className="mt-10 flex justify-center gutter lg:mt-14">
        <a
          href={CONTACT.instagramHref}
          target="_blank"
          rel="noreferrer"
          className="group/ig inline-flex min-h-12 items-center gap-3 border-b border-hairline pb-1 font-brand text-xs font-medium uppercase tracking-brand text-olive transition-colors duration-200 ease-bloom hover:border-burnt-orange"
        >
          Follow {CONTACT.instagramHandle} on Instagram
        </a>
      </div>
    </section>
  );
}
