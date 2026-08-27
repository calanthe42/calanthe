import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";
import { VIDEO_APPROVAL } from "@/lib/data";

/**
 * "See it before it's delivered" — the video-approval promise as a
 * quiet cream section. (UI now; wired to real WhatsApp later.)
 */
export function VideoApprovalSection() {
  return (
    <section className="bg-cream section-pad">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 gutter lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal>
          <Eyebrow>{VIDEO_APPROVAL.eyebrow}</Eyebrow>
          <h2 className="display-2 mt-3 font-display font-light text-olive">
            {VIDEO_APPROVAL.title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-sage">
            {VIDEO_APPROVAL.copy}
          </p>
        </Reveal>

        <Stagger className="flex flex-col gap-6">
          {VIDEO_APPROVAL.steps.map((step, i) => (
            <StaggerItem key={step}>
              <div className="flex items-center gap-4">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                  <Monogram className="absolute inset-0 text-burnt-orange/25" />
                  <span className="font-display text-lg text-olive">{i + 1}</span>
                </span>
                <p className="text-base leading-relaxed text-olive">{step}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
