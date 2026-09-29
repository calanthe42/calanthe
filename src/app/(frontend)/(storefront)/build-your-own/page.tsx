import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { Reveal } from "@/components/motion/Reveal";
import { BuildYourOwnForm } from "@/components/commerce/BuildYourOwnForm";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { OrchidPrint } from "@/components/ui/OrchidPrint";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    description:
      "Choose your budget, colours and preferences — Calanthe's florists take care of the flowers.",
    title: t.meta.buildYourOwn,
  };
}

export default async function BuildYourOwnPage() {
  const { t } = await getDictionary();
  return (
    /*
     * THE CONSULTATION HAPPENS ON THE SHOP'S OWN PAPER.
     *
     * The client's orchid wallpaper, printed tone on tone in olive at about
     * 5% — the same treatment the brand gives its paper bags and the booth's
     * panels. It sits behind everything and moves with the page; nothing
     * animates it, because the brand's rule for this surface is that it is
     * texture, never the subject.
     */
    <main className="relative isolate mx-auto max-w-6xl gutter section-pad">
      <OrchidPrint ground="canvas" />

      <Reveal className="mb-12 max-w-2xl lg:mb-16">
        <Eyebrow>{t.byo.eyebrow}</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          {t.byo.title}
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">
          {t.byo.intro}
        </p>
      </Reveal>

      <BuildYourOwnForm />
    </main>
  );
}
