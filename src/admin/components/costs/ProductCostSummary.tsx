"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { Button } from "@admin/ui/Button";
import { earnings, suggestedPriceFils, type CostSettingsValues } from "@backend/domain/costs";
import { signedMoney } from "./cost-view";

/**
 * "What it earns": the product's price against what it costs her, live.
 *
 * The price is the one in the product's own Pricing section, read as she
 * types it — there is no second price here to drift from the real one. The
 * arithmetic is the domain's (earnings, suggestedPriceFils), the same the
 * server uses, so what she reads before Save is what she gets after it.
 *
 * "Charge AED X to reach N%" writes into that same price field; nothing is
 * saved until she presses the product's Save.
 */

/** Exactly the domain's test for "reaches the target", before the margin is rounded for display. */
function reaches(receiveFils: number, profitFils: number, targetPercent: number): boolean {
  return receiveFils > 0 && profitFils * 100 >= targetPercent * receiveFils;
}

export function ProductCostSummary({
  priceFils,
  costFils,
  settings,
  onUsePrice,
}: {
  /** null when the price field is empty or not a number. */
  priceFils: number | null;
  costFils: number;
  settings: CostSettingsValues;
  onUsePrice: (priceFils: number) => void;
}) {
  const { t, plural, money, number } = useI18n();
  const target = settings.targetMarginPercent;
  const hasPrice = priceFils !== null && priceFils > 0;
  const hasCost = costFils > 0;
  const result = hasPrice ? earnings(priceFils, costFils, settings.vatRatePercent) : null;
  const suggestion = hasCost ? suggestedPriceFils(costFils, target, settings.vatRatePercent) : 0;
  const onTarget = result ? reaches(result.receiveFils, result.profitFils, target) : false;
  const margin = result?.marginPercent ?? null;
  const showCharge = hasCost && suggestion > 0 && (!hasPrice || (!onTarget && suggestion > (priceFils ?? 0)));
  const barWidth = margin === null ? 0 : Math.max(0, Math.min(100, margin));
  const tone = !result || !hasCost ? "neutral" : result.profitFils < 0 ? "danger" : onTarget ? "success" : "warning";

  return (
    <aside
      aria-labelledby="product-cost-summary-title"
      className="min-w-0 rounded-md border border-line bg-sunken/50 p-4"
    >
      <h3 id="product-cost-summary-title" className="text-sm font-semibold text-ink">
        {t("costs.product.summary.title")}
      </h3>

      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">{t("costs.product.summary.price")}</dt>
          <dd className="font-medium text-ink tabular">{hasPrice ? money(priceFils) : "—"}</dd>
        </div>
        {result ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-3">{t("costs.product.summary.vat", { rate: number(settings.vatRatePercent) })}</dt>
              <dd className="text-ink-2 tabular">{money(result.vatFils)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-3">{t("costs.product.summary.receive")}</dt>
              <dd className="text-ink-2 tabular">{money(result.receiveFils)}</dd>
            </div>
          </>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-2">{t("costs.product.summary.cost")}</dt>
          <dd className="font-medium text-ink tabular">{money(costFils)}</dd>
        </div>
      </dl>

      {result && hasCost ? (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink">{t("costs.product.summary.keep")}</span>
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-xl font-semibold tabular",
                  tone === "danger" ? "text-danger" : "text-ink",
                )}
              >
                {signedMoney(money, result.profitFils)}
              </span>
              {margin !== null ? (
                <span
                  className={cn(
                    "text-sm font-medium tabular",
                    tone === "success" && "text-success",
                    tone === "warning" && "text-warning",
                    tone === "danger" && "text-danger",
                  )}
                >
                  {t("costs.product.summary.margin", { percent: number(Math.round(margin)) })}
                </span>
              ) : null}
            </span>
          </div>

          {/* The margin as a bar, with her target as a line across it. */}
          <div
            role="img"
            aria-label={t("costs.product.summary.marginBar", {
              margin: number(Math.round(margin ?? 0)),
              target: number(target),
            })}
            className="relative mt-3 h-2 rounded-full bg-line"
          >
            <div
              className={cn(
                "h-full rounded-full",
                tone === "success" && "bg-success",
                tone === "warning" && "bg-warning",
                tone === "danger" && "bg-danger",
              )}
              style={{ width: `${barWidth}%` }}
            />
            <span
              aria-hidden
              className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink"
              style={{ insetInlineStart: `${Math.max(0, Math.min(100, target))}%` }}
            />
          </div>

          <p aria-live="polite" className="mt-3 text-sm leading-relaxed text-ink-2">
            {result.profitFils < 0
              ? t("costs.product.summary.loss", { amount: money(-result.profitFils) })
              : onTarget
                ? t("costs.product.summary.onTarget", { target: number(target) })
                : plural("costs.product.summary.underTarget", Math.max(1, Math.ceil(target - (margin ?? 0))), {
                    target: number(target),
                  })}{" "}
            <span className="text-ink-3">{t("costs.product.summary.targetLine")}</span>
          </p>
        </div>
      ) : (
        <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-3">
          {hasCost ? t("costs.product.summary.noPrice") : t("costs.product.summary.noCost")}
        </p>
      )}

      {showCharge ? (
        <Button block className="mt-4" icon="tag" onClick={() => onUsePrice(suggestion)}>
          {t("costs.product.summary.charge", { amount: money(suggestion), target: number(target) })}
        </Button>
      ) : null}

      <p className="mt-3 text-xs">
        <Link
          href="/admin/costs/settings"
          className="-my-3 inline-block py-3 text-ink-3 underline underline-offset-4 hover:text-ink"
        >
          {t("costs.product.summary.settings")}
        </Link>
      </p>
    </aside>
  );
}
