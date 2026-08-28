import type { Metadata } from "next";
import { DayPicker, FaqAccordion } from "@/components/commerce/MembershipInteractive";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/cn";
import { formatAed, membershipTiers } from "@/lib/data";

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
            <p className="mb-4 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream/60">
              Choose your delivery day
            </p>
            <DayPicker />
          </Reveal>
        </div>
      </section>

      {/* Tiers */}
      <section className="mx-auto max-w-7xl gutter section-pad">
        <Stagger className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          {membershipTiers.map((tier) => (
            <StaggerItem key={tier.id} className="h-full">
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-media-sm border p-7 lg:p-8",
                  tier.mostLoved ? "border-olive bg-cream" : "border-hairline bg-canvas",
                )}
              >
                {tier.mostLoved && (
                  <p className="absolute -top-3 left-7 bg-burnt-orange px-3 py-1 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream">
                    Most loved
                  </p>
                )}
                <h2 className="font-brand text-sm font-medium uppercase tracking-brand text-olive">
                  {tier.name}
                </h2>
                <p className="mt-4 font-display text-3xl font-light text-olive">
                  from {formatAed(tier.fromAedPerDelivery)}
                  <span className="ml-1 text-base text-sage">/ delivery</span>
                </p>
                <p className="mt-1 text-sm text-sage">4 deliveries a month</p>
                <p className="mt-4 text-base leading-relaxed text-olive">{tier.blurb}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2">
                  {tier.includes.map((line) => (
                    <li key={line} className="flex gap-2 text-sm text-sage">
                      <span aria-hidden className="text-burnt-orange">
                        ·
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={tier.mostLoved ? "primary" : "secondary"}
                  className="mt-7 w-full"
                >
                  Begin {tier.name}
                </Button>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-6 text-center text-xs text-sage">
          Membership checkout arrives with the backend phase — buttons are preview-only
          for now.
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
                <p className="font-display text-4xl font-light text-sage">0{i + 1}</p>
                <h3 className="mt-3 font-brand text-xs font-medium uppercase tracking-brand text-olive">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-sm text-base leading-relaxed text-sage">
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
