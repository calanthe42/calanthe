import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { DayPicker, FaqAccordion } from "@/components/commerce/MembershipInteractive";
import { MembershipTiers } from "@/components/commerce/MembershipTiers";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Eyebrow } from "@/components/ui/Eyebrow";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    description:
      "The Calanthe Membership — fresh flowers, thoughtfully arranged and delivered every week.",
    title: t.meta.membership,
  };
}

export default async function MembershipPage() {
  const { t } = await getDictionary();

  return (
    <main>
      {/* Olive hero */}
      <section className="bg-olive">
        <div className="mx-auto flex max-w-7xl flex-col items-center gutter section-pad text-center">
          <Reveal className="flex flex-col items-center">
            <Eyebrow className="text-cream/70">{t.ritual.eyebrow}</Eyebrow>
            <h1 className="display-2 mt-4 font-display font-light text-cream">
              {t.ritual.title}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-cream/80">
              {t.ritual.body}
            </p>
          </Reveal>
        </div>
      </section>

      {/*
        THE DAY COMES AFTER THE PLAN, NOT BEFORE IT.

        "Choose your delivery day" used to be the first thing on this page,
        sitting in the hero above the tiers — asking someone to pick a
        Tuesday before they had read what a membership is, what it costs or
        how often it arrives. The answer is meaningless until the plan is
        understood, and putting it first made the page read as a booking
        form rather than an invitation.

        It now sits between the tiers and "How it works": you read what you
        are joining, you choose a tier, and then you say which day suits.
        The picker itself is unchanged — only its place in the argument.
      */}

      {/* Tiers — the cards and the enquiry that begins one now live in a
          client component, because "Begin" opens a form rather than leaving
          the site for WhatsApp (see MembershipTiers.tsx). */}
      <section className="mx-auto max-w-7xl gutter section-pad">
        <MembershipTiers />
        <p className="mt-6 text-center text-base text-ink-muted lg:text-sm">
          {t.membership.nothingCharged}
        </p>
      </section>

      <section className="border-t border-hairline bg-cream">
        <div className="mx-auto flex max-w-3xl flex-col items-center gutter section-pad text-center">
          <Reveal className="w-full max-w-md">
            <Eyebrow>{t.membership.andThen}</Eyebrow>
            <h2 className="mt-3 font-display text-[2rem] font-light leading-tight text-olive lg:text-[2.5rem]">
              {t.membership.whichDay}
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-ink-muted">
              {t.membership.whichDayBody}
            </p>
            <div className="mt-9">
              <DayPicker />
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-cream">
        <div className="mx-auto max-w-7xl gutter section-pad">
          <Reveal>
            <Eyebrow>{t.membership.howItWorks}</Eyebrow>
          </Reveal>
          <Stagger className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
            {t.membership.steps.map((step, i) => (
              <StaggerItem key={step.title}>
                <p className="font-display text-4xl font-light text-ink-muted">
                  0{i + 1}
                </p>
                <h3 className="mt-3 font-brand text-xs font-medium uppercase tracking-brand text-olive">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-sm text-base leading-relaxed text-ink-muted">
                  {step.copy}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 section-pad">
        <Reveal>
          <Eyebrow>{t.membership.questionsAnswered}</Eyebrow>
          <div className="mt-6">
            <FaqAccordion items={t.faq.membership} />
          </div>
        </Reveal>
      </section>
    </main>
  );
}
