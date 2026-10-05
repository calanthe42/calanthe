"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@backend/actions/admin-shared";
import type { DiscountImpact, DiscountPreview } from "@backend/domain/discount-impact";
import { useI18n } from "@admin/i18n/client";
import { valueText } from "@admin/lib/discount-view";
import { ConfirmDialog } from "@admin/ui/Dialog";
import type { ActionOutcome } from "@admin/ui/useAction";

/**
 * "Make this discount live?" — said in numbers, before anything is saved.
 *
 * WHY. A sale goes live on every matching product the moment it is active.
 * Typing 50 where 5 was meant sells the catalogue at half price until
 * somebody notices, and every order paid meanwhile is honoured. So nothing
 * becomes active on a click alone: the server refuses the save
 * (`actions.discount.confirmNeeded`), works out what WOULD change from the
 * real catalogue, and this dialog states it —
 *
 *   "This changes the price of 42 products on the store now. The lowest
 *    price becomes AED 96 (Peony Cloud, was AED 480)."
 *
 * — and only her yes sends the save again, this time confirmed.
 *
 * THE SERVER DECIDES WHEN TO ASK. A draft, a discount scheduled for later,
 * a rename of a live one: the first save simply succeeds and no dialog
 * appears. The screen never guesses.
 */

const CONFIRM_NEEDED = "actions.discount.confirmNeeded";

function ImpactBody({ impact }: { impact: DiscountImpact }) {
  const i18n = useI18n();
  const { t, plural, money } = i18n;

  if (impact.kind === "code") {
    return (
      <span className="grid gap-2">
        <span>
          {t("discounts.confirm.codeNow", { code: impact.code, value: valueText(i18n, impact) })}
        </span>
        {impact.minSubtotalFils > 0 ? (
          <span>{t("discounts.confirm.codeMinimum", { amount: money(impact.minSubtotalFils) })}</span>
        ) : null}
        {impact.usageLimit !== null ? (
          <span>{plural("discounts.summary.limit", impact.usageLimit)}</span>
        ) : null}
        {impact.oncePerCustomer ? <span>{t("discounts.summary.oncePerCustomer")}</span> : null}
        <span>{t("discounts.confirm.honoured")}</span>
      </span>
    );
  }

  if (impact.productCount === 0) {
    return <span>{t("discounts.confirm.saleNothing")}</span>;
  }

  return (
    <span className="grid gap-2">
      <span className="font-medium text-ink">
        {plural("discounts.confirm.saleProducts", impact.productCount)}
      </span>
      {impact.lowest ? (
        <span>
          {t("discounts.confirm.lowest", {
            now: money(impact.lowest.nowFils),
            name: impact.lowest.name,
            was: money(impact.lowest.wasFils),
          })}
        </span>
      ) : null}
      {impact.deepest ? (
        <span>
          {t("discounts.confirm.deepest", {
            percent: impact.deepest.percent,
            name: impact.deepest.name,
            was: money(impact.deepest.wasFils),
            now: money(impact.deepest.nowFils),
          })}
        </span>
      ) : null}
      <span>{t("discounts.confirm.honoured")}</span>
    </span>
  );
}

/** The dialog, and a way to ask it a question and wait for the answer. */
export function useActivationConfirm(): {
  ask: (impact: DiscountImpact) => Promise<boolean>;
  dialog: ReactNode;
} {
  const { t } = useI18n();
  const [impact, setImpact] = useState<DiscountImpact | null>(null);
  const resolver = useRef<((yes: boolean) => void) | null>(null);

  const ask = useCallback(
    (next: DiscountImpact) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setImpact(next);
      }),
    [],
  );

  /* Answers once: the dialog's own close event arrives after a yes as well,
     and by then there is nobody left to tell. */
  const settle = useCallback((yes: boolean) => {
    resolver.current?.(yes);
    resolver.current = null;
    setImpact(null);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={impact !== null}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
      title={t("discounts.confirm.title")}
      body={impact ? <ImpactBody impact={impact} /> : null}
      confirmLabel={t("discounts.confirm.yes")}
      cancelLabel={t("discounts.confirm.no")}
      tone="default"
    />
  );

  return { ask, dialog };
}

/**
 * Save; and if the server says "confirm first", show what would change and
 * save again only on a yes.
 *
 * A no is not a failure: nothing was saved, and the outcome says `cancelled`
 * so the screen goes back to idle without an error.
 */
export async function withActivationConfirm(
  attempt: (confirmed: boolean) => Promise<ActionResult>,
  preview: () => Promise<DiscountPreview>,
  ask: (impact: DiscountImpact) => Promise<boolean>,
): Promise<ActionOutcome> {
  const first = await attempt(false);
  if (first.ok || first.code !== CONFIRM_NEEDED) return first;

  const previewed = await preview();
  if (!previewed.ok) return previewed;

  const yes = await ask(previewed.impact);
  if (!yes) return { ok: false, message: "", cancelled: true };
  return attempt(true);
}
