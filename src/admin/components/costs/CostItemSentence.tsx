"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { ActionForm } from "@admin/ui/ActionForm";
import { ButtonLink } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { Field, Input, PrefixInput, Switch, fieldClasses } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";
import { saveCostItem } from "@backend/actions/costs";
import {
  COST_GROUPS,
  ONE_UNITS,
  aedTextToFils,
  type CostGroup,
  type CostItemRow,
  type OneUnit,
} from "@backend/domain/costs";
import { PACK_NAMES, filsToAedInput, packNameOf, perOneText, whereFromText, type PackName } from "./cost-view";

/**
 * Something she buys, as one sentence she can edit:
 *
 *   [Peach Avalanche rose] comes as [a bunch] of [20] [stems]
 *   It is: (Flowers) (Greenery) (Packaging) (Something extra)
 *   I paid AED [3.20] for one stem            ← only while no invoice has it
 *
 * Most of what she buys is made from her invoices; this is the fallback for
 * something no invoice has yet, and the place to say how a thing comes or
 * that she no longer buys it. Once an invoice has it, the price comes from
 * there — the sentence says so, and there is no box to overwrite it.
 *
 * The fields are the action's (backend/actions/costs.ts saveCostItem):
 * name, group, packName, unitsPerPack, one, priceAed (the price for ONE, in
 * dirhams), archived.
 */

export type CostItemSentenceValues = Pick<
  CostItemRow,
  "name" | "group" | "packName" | "unitsPerPack" | "one" | "priceForOneFils" | "costSource" | "lastPaidAt" | "lastSupplier" | "archived"
> & { id?: number };

/** The sentence's inline controls: a phone-sized tap target that sits in a line of words. */
const INLINE = cn(fieldClasses, "w-auto");

export function CostItemSentence({ values, aside }: { values: CostItemSentenceValues; aside?: ReactNode }) {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const router = useRouter();
  const isEdit = typeof values.id === "number";

  const [pack, setPack] = useState<PackName>(packNameOf(values.packName) ?? "bunch");
  const [unitsPerPack, setUnitsPerPack] = useState(String(values.unitsPerPack || 1));
  const [one, setOne] = useState<OneUnit>(values.one);
  const [group, setGroup] = useState<CostGroup>(values.group);
  const [price, setPrice] = useState(values.costSource === "typed" ? filsToAedInput(values.priceForOneFils) : "");

  /* The server keeps an invoice price whatever is typed, so there is no box to type it in. */
  const fromInvoice = values.costSource === "invoice";
  const single = pack === "single";
  const count = Number(unitsPerPack.replace(/[\s,]/g, "")) || 1;
  const typedPrice = aedTextToFils(price);

  return (
    <ActionForm
      action={saveCostItem}
      submitLabel={isEdit ? undefined : t("costs.item.create")}
      onSuccess={(result) => {
        if (!isEdit && result.id) router.push(`/admin/costs/buy/${result.id}?created=1`);
      }}
      secondary={
        <ButtonLink href="/admin/costs/buy" variant="ghost">
          {t("common.cancel")}
        </ButtonLink>
      }
    >
      {isEdit ? <input type="hidden" name="id" value={values.id} /> : null}
      {/* A thing that comes singly comes one at a time: one in each. */}
      {single ? <input type="hidden" name="unitsPerPack" value="1" /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-6">
          <FormSection id="cost-item-sentence" title={t("costs.item.sentence")}>
            <Field id="name" label={t("costs.item.name")} required>
              <Input
                id="name"
                name="name"
                defaultValue={values.name}
                required
                maxLength={80}
                autoComplete="off"
                dir="auto"
                placeholder={t("costs.item.namePlaceholder")}
              />
            </Field>

            {/* "comes as [a bunch] of [20] [stems]": words and controls in one
                line that wraps on a phone, each control a 44px target. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink-2">
              <span>{t("costs.item.comesAs")}</span>
              <select
                name="packName"
                aria-label={t("costs.item.packKind")}
                value={pack}
                onChange={(event) => setPack(event.target.value as PackName)}
                className={cn(INLINE, "cursor-pointer pe-8")}
              >
                {PACK_NAMES.map((value) => (
                  <option key={value} value={value}>
                    {t(`costs.packAs.${value}`)}
                  </option>
                ))}
              </select>
              {single ? null : (
                <>
                  <span>{t("costs.item.of")}</span>
                  <input
                    name="unitsPerPack"
                    aria-label={t("costs.item.perPack")}
                    inputMode="decimal"
                    autoComplete="off"
                    required
                    value={unitsPerPack}
                    onChange={(event) => setUnitsPerPack(event.target.value)}
                    className={cn(INLINE, "w-20 text-center tabular")}
                  />
                </>
              )}
              <select
                name="one"
                aria-label={t("costs.item.oneKind")}
                value={one}
                onChange={(event) => setOne(event.target.value as OneUnit)}
                className={cn(INLINE, "cursor-pointer pe-8")}
              >
                {ONE_UNITS.map((value) => (
                  <option key={value} value={value}>
                    {plural(`costs.oneWord.${value}`, single ? 2 : count)}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium text-ink">{t("costs.item.groupLabel")}</legend>
              <div className="flex flex-wrap gap-2">
                {COST_GROUPS.map((value) => (
                  <label
                    key={value}
                    className={cn(
                      "inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                      group === value
                        ? "border-ink bg-ink text-page"
                        : "border-line-strong bg-surface text-ink-2 hover:bg-hover hover:text-ink",
                    )}
                  >
                    <input
                      type="radio"
                      name="group"
                      value={value}
                      checked={group === value}
                      onChange={() => setGroup(value)}
                      className="sr-only"
                    />
                    {t(`costs.group.${value}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            {fromInvoice ? (
              <p className="flex items-start gap-2 rounded-md bg-sunken/60 px-3 py-3 text-sm leading-relaxed text-ink-2">
                <Icon name="receipt" className="mt-0.5 h-4 w-4 text-ink-3" />
                <span>
                  {t("costs.item.fromInvoice", {
                    price: perOneText(i18n, values.priceForOneFils ?? 0, values.one),
                    when: whereFromText(i18n, values),
                  })}
                </span>
              </p>
            ) : (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink-2">
                  <span>{t("costs.item.paid")}</span>
                  <span className="w-36">
                    <PrefixInput
                      id="priceAed"
                      name="priceAed"
                      prefix="AED"
                      withHint
                      aria-label={t("costs.item.priceLabel")}
                      inputMode="decimal"
                      autoComplete="off"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="3.20"
                      className="tabular"
                    />
                  </span>
                  <span>{t(`costs.forOne.${one}`)}</span>
                  {typedPrice !== null && Number.isFinite(typedPrice) && typedPrice > 0 ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-ink tabular">
                      <Icon name="arrowRight" className="h-4 w-4 text-ink-3" />
                      {perOneText(i18n, typedPrice, one)}
                    </span>
                  ) : null}
                </div>
                <p id="priceAed-hint" className="mt-1.5 text-xs leading-relaxed text-ink-3">
                  {t("costs.item.priceHint")}
                </p>
              </div>
            )}

            {isEdit ? (
              <div className="border-t border-line pt-4">
                <Switch
                  name="archived"
                  defaultChecked={values.archived}
                  label={t("costs.item.stopped")}
                  hint={t("costs.item.stoppedHint")}
                />
              </div>
            ) : null}
          </FormSection>
        </div>

        {aside ? <div className="min-w-0 space-y-6">{aside}</div> : null}
      </div>
    </ActionForm>
  );
}
