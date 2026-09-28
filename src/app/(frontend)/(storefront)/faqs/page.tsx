import type { Metadata } from "next";
import { FaqAccordion } from "@/components/commerce/MembershipInteractive";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    description:
      "Delivery times, freshness, substitutions, video approval and payment — Calanthe's most-asked questions.",
    title: t.meta.faqs,
  };
}

export default async function FaqsPage() {
  const { t } = await getDictionary();

  return (
    <main className="mx-auto max-w-3xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>{t.help.eyebrow}</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          {t.help.faqsTitle}
        </h1>
      </Reveal>
      <FaqAccordion items={t.faq.site} />
    </main>
  );
}
