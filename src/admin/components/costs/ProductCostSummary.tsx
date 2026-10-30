"use client";

import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { intlLocale } from "@admin/i18n/translate";
import { Badge, type Tone } from "@admin/ui/Badge";
import {
  FLORIST_GUIDE_PER_100,
  guideBand,
  per100,
  priceForGuide,
  type GuideBand,
} from "@backend/domain/costs";
import { per100Number } from "./cost-view";

/**
 * "What it leaves you", live, in three sentences:
 *
 *   Costs you AED 91 to make. You keep AED 359.
 *   AED 20 of every AED 100 goes on flowers and packaging. Florists aim for
 *   33 or less.                                                  [Healthy]
 *   At AED 33 of every 100 the price would be AED 280.   ← only above 33
 *
 * The price is the one in the product's own Pricing section, read as she
 * types it — there is no second price here to drift from the real one. No
 * VAT is taken out of it: the shop is not VAT-registered (src/lib/business.ts),
 * so the whole price is hers.
 *
 * The price at the guide is a SENTENCE, never a button that rewrites her
 * price: the price is her decision, and a button inside a form is easy to
 * press by mistake.
 *
 * A missing price is never counted as nothing in silence: the cost reads "at
 * least", and what she keeps "at most", with the names of what has no price.
 */

const TONE: Record<GuideBand, Tone> = { healthy: "success", watch: "warning", tooMuch: "danger" };
const LABEL = { healthy: "costs.product.summary.healthy", watch: "costs.product.summary.watch", tooMuch: "costs.product.summary.tooMuch" } as const;

export function ProductCostSummary({
  priceFils,
  cost,
  hasLines,
}: {
  /** null when the price field is empty or not a number. */
  priceFils: number | null;
  cost: { costFils: number; atLeast: boolean; missingNames: string[] };
  hasLines: boolean;
}) {
  const { t, plural, money, number, locale } = useI18n();
  const hasPrice = priceFils !== null && priceFils > 0;

  if (!hasLines) {
    return (
      <aside className="min-w-0 rounded-md border border-line bg-sunken/50 p-4">
        <h3 className="text-sm font-semibold text-ink">{t("costs.product.summary.title")}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">{t("costs.product.summary.noCost")}</p>
      </aside>
    );
  }

  const names =
    cost.missingNames.length > 0
      ? new Intl.ListFormat(intlLocale(locale), { type: "conjunction" }).format(cost.missingNames)
      : t("costs.product.unknownItem");
  const costText = money(cost.costFils);
  const costSentence = cost.atLeast
    ? plural("costs.product.summary.atLeast", Math.max(1, cost.missingNames.length), { cost: costText, names })
    : t("costs.product.summary.costs", { cost: costText });

  const keepFils = hasPrice ? priceFils - cost.costFils : null;
  const share = hasPrice ? per100(cost.costFils, priceFils) : null;
  const band = guideBand(share);
  const overGuide = share !== null && share > FLORIST_GUIDE_PER_100;

  return (
    <aside
      aria-labelledby="product-cost-summary-title"
      className="min-w-0 rounded-md border border-line bg-sunken/50 p-4"
    >
      <h3 id="product-cost-summary-title" className="text-sm font-semibold text-ink">
        {t("costs.product.summary.title")}
      </h3>

      <div aria-live="polite" className="mt-2 space-y-3 text-sm leading-relaxed">
        <p className="text-ink">
          {costSentence}{" "}
          {keepFils === null ? (
            <span className="text-ink-3">{t("costs.product.summary.noPrice")}</span>
          ) : keepFils < 0 ? (
            <span className="font-medium text-danger">
              {t("costs.product.summary.loss", { amount: money(-keepFils) })}
            </span>
          ) : (
            <span className="font-medium">
              {cost.atLeast
                ? t("costs.product.summary.keepAtMost", { amount: money(keepFils) })
                : t("costs.product.summary.keep", { amount: money(keepFils) })}
            </span>
          )}
        </p>

        {share !== null && band !== null ? (
          <div className="border-t border-line pt-3">
            <p className="text-ink-2">
              {t(cost.atLeast ? "costs.product.summary.shareAtLeast" : "costs.product.summary.share", {
                amount: per100Number(number, share),
                guide: number(FLORIST_GUIDE_PER_100),
              })}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Badge tone={TONE[band]} dot>
                {t(LABEL[band])}
              </Badge>
              {/* The share as a bar, with the florists' guide as a line across it. */}
              <span aria-hidden className="relative h-2 min-w-0 flex-1 rounded-full bg-line">
                <span
                  className={cn(
                    "absolute inset-y-0 start-0 rounded-full",
                    band === "healthy" && "bg-success",
                    band === "watch" && "bg-warning",
                    band === "tooMuch" && "bg-danger",
                  )}
                  style={{ width: `${Math.min(100, share)}%` }}
                />
                <span
                  className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink"
                  style={{ insetInlineStart: `${FLORIST_GUIDE_PER_100}%` }}
                />
              </span>
            </div>
            {overGuide ? (
              <p className="mt-3 text-ink-2">
                {t("costs.product.summary.guidePrice", {
                  guide: number(FLORIST_GUIDE_PER_100),
                  price: money(priceForGuide(cost.costFils)),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
