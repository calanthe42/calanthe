import type { Metadata } from "next";
import { DayPicker, FaqAccordion } from "@/components/commerce/MembershipInteractive";
import { MembershipTiers } from "@/components/commerce/MembershipTiers";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Membership",
  description:
    "The Calanthe Membership — fresh flowers, thoughtfully arranged and delivered every week.",
};

const steps = [
  {
    title: "Choose your ritual",
    copy: "Pick the tier that suits your table — change it any time.",
  },
  {
    title: "Pick your day",
    copy: "One day a week is yours. We reserve your route and your stems.",
  },
  {
    title: "We deliver, weekly",
    copy: "A fresh composition arrives at your door, four times a month.",
  },
] as const;

export default function MembershipPage() {
  return (
    <main>
      {/* Olive hero */}
      <section className="bg-olive">
        <div className="mx-auto flex max-w-7xl flex-col items-center gutter section-pad text-center">
          <Reveal className="flex flex-col items-center">
            <Eyebrow className="text-cream/70">A Weekly Ritual</Eyebrow>
            <h1 className="display-2 mt-4 font-display font-light text-cream">
              The Calanthe Membership
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-cream/80">
              Fresh flowers, thoughtfully arranged and delivered to your door every week.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="mt-12 w-full max-w-md">
            <p className="mb-4 font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-cream/60">
              Choose your delivery day
            </p>
            <DayPicker />
          </Reveal>
        </div>
      </section>

      {/* Tiers — the cards and the enquiry that begins one now live in a
          client component, because "Begin" opens a form rather than leaving
          the site for WhatsApp (see MembershipTiers.tsx). */}
      <section className="mx-auto max-w-7xl gutter section-pad">
        <MembershipTiers />
        <p className="mt-6 text-center text-sm text-ink-muted">
          Nothing is charged here. A florist confirms the details with you
          before any membership begins.
        </p>
      </section>

      {/* How it works */}
      <section className="bg-cream">
        <div className="mx-auto max-w-7xl gutter section-pad">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
          </Reveal>
          <Stagger className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
            {steps.map((step, i) => (
              <StaggerItem key={step.title}>
                <p className="font-display text-4xl font-light text-ink-muted">0{i + 1}</p>
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
          <Eyebrow>Questions, answered</Eyebrow>
          <div className="mt-6">
            <FaqAccordion />
          </div>
        </Reveal>
      </section>
    </main>
  );
}
