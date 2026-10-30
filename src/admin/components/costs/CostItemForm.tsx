"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useI18n } from "@admin/i18n/client";
import { ActionButton } from "@admin/ui/ActionButton";
import { ActionForm, useMarkDirty } from "@admin/ui/ActionForm";
import { Button, ButtonLink } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { Field, Input, PrefixInput, Select, Textarea } from "@admin/ui/Field";
import { archiveCostItem, saveCostItem } from "@backend/actions/costs";
import {
  COST_KINDS,
  USE_UNITS,
  aedTextToFils,
  parseSwatch,
  type CostKind,
  type UseUnit,
} from "@backend/domain/costs";
import { filsToAedInput } from "./cost-view";

/**
 * Add or edit one flower or material in the owner's library.
 *
 * The cost she types is the cost of ONE use-unit — one stem, one metre — in
 * AED (`unitCostAed`; the action stores it in fils). Most of what she buys
 * comes in packs, so when a pack holds more than one she can type the pack's
 * price instead and the cost of one is worked out for her; the pack price
 * itself is not stored, only the cost of one.
 *
 * On a wide screen the invoice names and notes sit in a side column, beside
 * what the item is used in (`aside`, on the edit page).
 */

export type CostItemFormValues = {
  id?: number;
  name: string;
  kind: CostKind;
  useUnit: UseUnit;
  packName: string;
  unitsPerPack: number;
  currentUnitCostFils: number;
  costSource: "purchase" | "manual";
  swatch: string | null;
  notes: string;
  aliases: string[];
  archived: boolean;
};

/** A number as she types it, or null: "1,200.50" → 1200.5. */
function typedNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s,]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** The colour dot: the browser's own colour picker, and a way back to none. */
function SwatchField({ initial }: { initial: string | null }) {
  const { t } = useI18n();
  const markDirty = useMarkDirty();
  const [swatch, setSwatch] = useState<string | null>(initial);
  return (
    <Field id="swatch-picker" label={t("costs.items.form.swatch")} hint={t("costs.items.form.swatchHint")}>
      <input type="hidden" name="swatch" value={swatch ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="swatch-picker"
          type="color"
          aria-describedby="swatch-picker-hint"
          title={t("costs.items.form.swatchPick")}
          value={swatch ?? "#ffffff"}
          onChange={(event) => setSwatch(parseSwatch(event.target.value))}
          className="h-11 w-14 cursor-pointer rounded-md border border-line-strong bg-field p-1"
        />
        <span className="text-sm text-ink-2 tabular" dir="ltr">
          {swatch ?? t("costs.items.form.swatchNone")}
        </span>
        {swatch ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSwatch(null);
              markDirty();
            }}
          >
            {t("costs.items.form.swatchRemove")}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

export function CostItemForm({
  values,
  vatReclaimable,
  aside,
}: {
  values: CostItemFormValues;
  /** From the cost settings: whether a cost is typed with or without VAT. */
  vatReclaimable: boolean;
  aside?: ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const itemId = values.id;
  const isEdit = typeof itemId === "number";

  const [useUnit, setUseUnit] = useState<UseUnit>(values.useUnit);
  const [unitsPerPack, setUnitsPerPack] = useState(String(values.unitsPerPack || 1));
  const [unitCost, setUnitCost] = useState(filsToAedInput(values.currentUnitCostFils));
  const [packPrice, setPackPrice] = useState("");

  const perPack = typedNumber(unitsPerPack);
  const unitWord = t(`costs.items.unitWord.${useUnit}`);
  const showPackPrice = perPack !== null && perPack > 1;

  /* The pack's price ÷ how many it holds, to a hundredth of a fils. */
  const fromPack = (price: string, units: number | null) => {
    const fils = aedTextToFils(price);
    if (fils === null || !Number.isFinite(fils) || !units || units <= 0) return;
    setUnitCost(filsToAedInput(fils / units));
  };

  return (
    <ActionForm
      action={saveCostItem}
      submitLabel={isEdit ? undefined : t("costs.items.form.create")}
      onSuccess={(result) => {
        if (!isEdit && result.id) router.push(`/admin/costs/items/${result.id}?created=1`);
      }}
      secondary={
        <ButtonLink href="/admin/costs/items" variant="ghost">
          {t("common.cancel")}
        </ButtonLink>
      }
      destructive={
        typeof itemId === "number" ? (
          values.archived ? (
            <ActionButton
              icon="upload"
              label={t("costs.items.form.unarchive")}
              action={() => archiveCostItem(itemId, false)}
            />
          ) : (
            <ActionButton
              variant="danger"
              icon="box"
              label={t("costs.items.form.archive")}
              action={() => archiveCostItem(itemId, true)}
              confirm={{
                title: t("costs.items.form.archiveTitle", { name: values.name }),
                body: t("costs.items.form.archiveBody"),
                confirmLabel: t("costs.items.form.archiveConfirm"),
              }}
            />
          )
        ) : null
      }
    >
      {typeof itemId === "number" ? <input type="hidden" name="id" value={itemId} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-6">
          <FormSection id="cost-item-what" title={t("costs.items.form.sections.item")}>
            <Field id="name" label={t("costs.items.form.name")} required>
              <Input
                id="name"
                name="name"
                defaultValue={values.name}
                required
                maxLength={120}
                autoComplete="off"
                placeholder={t("costs.items.form.namePlaceholder")}
              />
            </Field>
            <Field id="kind" label={t("costs.items.form.kind")}>
              <Select
                id="kind"
                name="kind"
                defaultValue={values.kind}
                options={COST_KINDS.map((value) => ({ value, label: t(`costs.items.kind.${value}`) }))}
              />
            </Field>
            <SwatchField initial={values.swatch} />
          </FormSection>

          <FormSection
            id="cost-item-buying"
            title={t("costs.items.form.sections.buying")}
            description={t("costs.items.form.sections.buyingHint")}
          >
            <Field id="useUnit" label={t("costs.items.form.useUnit")} hint={t("costs.items.form.useUnitHint")}>
              <Select
                id="useUnit"
                name="useUnit"
                withHint
                value={useUnit}
                onChange={(event) => setUseUnit(event.target.value as UseUnit)}
                options={USE_UNITS.map((value) => ({ value, label: t(`costs.items.unit.${value}`) }))}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="packName" label={t("costs.items.form.packName")} hint={t("costs.items.form.packNameHint")}>
                <Input
                  id="packName"
                  name="packName"
                  withHint
                  maxLength={40}
                  autoComplete="off"
                  defaultValue={values.packName}
                  placeholder={t("costs.items.form.packNamePlaceholder")}
                />
              </Field>
              <Field
                id="unitsPerPack"
                label={t("costs.items.form.unitsPerPack")}
                hint={t("costs.items.form.unitsPerPackHint")}
                required
              >
                <Input
                  id="unitsPerPack"
                  name="unitsPerPack"
                  withHint
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value={unitsPerPack}
                  onChange={(event) => {
                    setUnitsPerPack(event.target.value);
                    if (packPrice) fromPack(packPrice, typedNumber(event.target.value));
                  }}
                  className="tabular"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection id="cost-item-cost" title={t("costs.items.form.sections.cost")}>
            <div className="grid gap-5 sm:grid-cols-2">
              {showPackPrice ? (
                <Field
                  id="packPrice"
                  label={t("costs.items.form.packPrice")}
                  hint={t("costs.items.form.packPriceHint", { unit: unitWord })}
                >
                  <PrefixInput
                    id="packPrice"
                    prefix="AED"
                    withHint
                    inputMode="decimal"
                    autoComplete="off"
                    value={packPrice}
                    onChange={(event) => {
                      setPackPrice(event.target.value);
                      fromPack(event.target.value, perPack);
                    }}
                    className="tabular"
                  />
                </Field>
              ) : null}
              <Field
                id="unitCostAed"
                label={t("costs.items.form.unitCost", { unit: unitWord })}
                hint={
                  values.costSource === "purchase"
                    ? t("costs.items.form.fromPurchaseHint")
                    : vatReclaimable
                      ? t("costs.items.form.unitCostHintReclaim")
                      : t("costs.items.form.unitCostHintNoReclaim")
                }
                required
              >
                <PrefixInput
                  id="unitCostAed"
                  name="unitCostAed"
                  prefix="AED"
                  withHint
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                  placeholder="3.60"
                  className="tabular"
                />
              </Field>
            </div>
          </FormSection>
        </div>

        <div className="min-w-0 space-y-6">
          {aside}
          <FormSection id="cost-item-more" title={t("costs.items.form.sections.more")}>
            <Field id="aliases" label={t("costs.items.form.aliases")} hint={t("costs.items.form.aliasesHint")}>
              <Textarea
                id="aliases"
                name="aliases"
                withHint
                rows={3}
                dir="auto"
                defaultValue={values.aliases.join("\n")}
                spellCheck={false}
              />
            </Field>
            <Field id="notes" label={t("costs.items.form.notes")} hint={t("costs.items.form.notesHint")}>
              <Textarea id="notes" name="notes" withHint rows={3} maxLength={1000} defaultValue={values.notes} />
            </Field>
          </FormSection>
        </div>
      </div>
    </ActionForm>
  );
}
