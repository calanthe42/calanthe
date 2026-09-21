import type { Metadata } from "next";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  deliveryZones,
  formatAed,
  FREE_DELIVERY_THRESHOLD_AED,
  timeSlots,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Delivery Information",
  description:
    "Flower delivery across all seven Emirates — days, fees and time windows for Calanthe deliveries.",
};

export default function DeliveryPage() {
  return (
    <main className="mx-auto max-w-4xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>Help</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          Delivery, across all seven Emirates.
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-muted">
          {/* No same-day promise: the atelier does not offer it. The cutoff
              still governs which days the picker can offer, which is a
              scheduling rule rather than a claim. */}
          Choose the day and the window that suit them, across all seven
          Emirates. Delivery is complimentary on orders over{" "}
          {formatAed(FREE_DELIVERY_THRESHOLD_AED)}.
        </p>
      </Reveal>

      <Reveal>
        <h2 className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-olive">
          Delivery windows
        </h2>
        <div className="flex flex-wrap gap-2">
          {timeSlots.map((s) => (
            <span
              key={s}
              className="rounded-sm border border-hairline px-4 py-2 text-sm text-olive"
            >
              {s}
            </span>
          ))}
        </div>
      </Reveal>

      <Stagger className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-media-sm border border-hairline bg-hairline sm:grid-cols-2">
        {deliveryZones.map((zone) => (
          <StaggerItem key={zone.id} className="bg-canvas">
            <div className="flex items-baseline justify-between px-5 py-4">
              <p className="text-base text-olive">{zone.name}</p>
              <p className="text-sm text-ink-muted">{formatAed(zone.feeAed)}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-10">
        <p className="max-w-lg text-base leading-relaxed text-ink-muted lg:text-sm">
          Before every delivery, your florist sends a photo or video of the finished
          arrangement on WhatsApp for your approval. We contact the recipient only to
          coordinate timing — never with the price.
        </p>
      </Reveal>
    </main>
  );
}
