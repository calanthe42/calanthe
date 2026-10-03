import type { Metadata } from "next";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getDictionary } from "@/lib/i18n/server";
import {
  deliveryZones,
  formatAed,
  timeSlots,
} from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    description:
      "Flower delivery across Abu Dhabi — days, fees and time windows for Calanthe deliveries.",
    title: t.meta.delivery,
  };
}

export default async function DeliveryPage() {
  const { t } = await getDictionary();

  return (
    <main className="mx-auto max-w-4xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>{t.help.eyebrow}</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          {t.help.deliveryTitle}
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-muted">
          {/* No same-day promise: the atelier does not offer it. The cutoff
              still governs which days the picker can offer, which is a
              scheduling rule rather than a claim. */}
          {t.help.deliveryIntro}
        </p>
      </Reveal>

      <Reveal>
        <h2 className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-olive">
          {t.help.deliveryWindows}
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
              <p className="text-base text-olive">{t.zoneNames[zone.id] ?? zone.name}</p>
              <p className="text-sm text-ink-muted">
                {zone.feeAed === 0 ? t.checkout.complimentary : formatAed(zone.feeAed)}
              </p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-10">
        <p className="max-w-lg text-base leading-relaxed text-ink-muted lg:text-sm">
          {t.help.approvalNote}
        </p>
      </Reveal>
    </main>
  );
}
