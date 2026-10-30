"use client";

import { useState } from "react";
import { useI18n } from "@admin/i18n/client";
import { ActionForm } from "@admin/ui/ActionForm";
import { FormSection } from "@admin/ui/Content";
import { Field, Input, PrefixInput, Switch } from "@admin/ui/Field";
import { saveCostSettings } from "@backend/actions/costs";
import { COST_LIMITS, suggestedPriceFils, type CostSettingsValues } from "@backend/domain/costs";
import { filsToAedInput } from "./cost-view";

/**
 * The owner's cost settings: her margin target, what an hour of making
 * costs, the allowance for lost flowers a new recipe starts with, and VAT.
 *
 * The target is shown working, live, on a round example — "an arrangement
 * that costs you AED 100 should sell for AED 265 or more" — with the same
 * suggestedPriceFils the product editor uses, so the number means something
 * before she saves it. The action re-checks every bound.
 */

const EXAMPLE_COST_FILS = 10_000;

function typedPercent(raw: string): number | null {
  const value = Number(raw.replace(",", ".").trim());
  return raw.trim() !== "" && Number.isFinite(value) ? value : null;
}

export function CostSettingsForm({ values }: { values: CostSettingsValues }) {
  const { t, money, number } = useI18n();
  const [target, setTarget] = useState(String(values.targetMarginPercent));
  const [vatRate, setVatRate] = useState(String(values.vatRatePercent));

  const targetValue = typedPercent(target);
  const vatValue = typedPercent(vatRate) ?? values.vatRatePercent;
  const exampleReady =
    targetValue !== null &&
    targetValue >= COST_LIMITS.targetMarginPercent.min &&
    targetValue <= COST_LIMITS.targetMarginPercent.max;

  return (
    <ActionForm action={saveCostSettings}>
      <div className="max-w-2xl space-y-6">
        <FormSection
          id="cost-settings-target"
          title={t("costs.settings.sections.target")}
          description={t("costs.settings.sections.targetHint")}
        >
          <Field id="targetMarginPercent" label={t("costs.settings.targetMargin")} hint={t("costs.settings.targetMarginHint")} required>
            <Input
              id="targetMarginPercent"
              name="targetMarginPercent"
              withHint
              type="number"
              inputMode="decimal"
              min={COST_LIMITS.targetMarginPercent.min}
              max={COST_LIMITS.targetMarginPercent.max}
              step="1"
              required
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="tabular sm:max-w-40"
            />
          </Field>
          {exampleReady ? (
            <p aria-live="polite" className="rounded-md bg-sunken px-3 py-2.5 text-sm leading-relaxed text-ink-2">
              {t("costs.settings.example", {
                percent: number(targetValue),
                cost: money(EXAMPLE_COST_FILS),
                price: money(suggestedPriceFils(EXAMPLE_COST_FILS, targetValue, vatValue)),
              })}
            </p>
          ) : null}
        </FormSection>

        <FormSection
          id="cost-settings-making"
          title={t("costs.settings.sections.making")}
          description={t("costs.settings.sections.makingHint")}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="labourRatePerHourAed" label={t("costs.settings.labourRate")} hint={t("costs.settings.labourRateHint")} required>
              <PrefixInput
                id="labourRatePerHourAed"
                name="labourRatePerHourAed"
                prefix="AED"
                withHint
                inputMode="decimal"
                autoComplete="off"
                required
                defaultValue={filsToAedInput(values.labourRatePerHourFils) || "0"}
                className="tabular"
              />
            </Field>
            <Field id="defaultWastePercent" label={t("costs.settings.defaultWaste")} hint={t("costs.settings.defaultWasteHint")} required>
              <Input
                id="defaultWastePercent"
                name="defaultWastePercent"
                withHint
                type="number"
                inputMode="decimal"
                min={COST_LIMITS.wastePercent.min}
                max={COST_LIMITS.wastePercent.max}
                step="1"
                required
                defaultValue={String(values.defaultWastePercent)}
                className="tabular"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection id="cost-settings-vat" title={t("costs.settings.sections.vat")}>
          <Switch
            name="vatReclaimable"
            label={t("costs.settings.vatReclaimable")}
            hint={t("costs.settings.vatReclaimableHint")}
            defaultChecked={values.vatReclaimable}
          />
          <Field id="vatRatePercent" label={t("costs.settings.vatRate")} hint={t("costs.settings.vatRateHint")} required>
            <Input
              id="vatRatePercent"
              name="vatRatePercent"
              withHint
              type="number"
              inputMode="decimal"
              min={COST_LIMITS.vatRatePercent.min}
              max={COST_LIMITS.vatRatePercent.max}
              step="0.5"
              required
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
              className="tabular sm:max-w-40"
            />
          </Field>
        </FormSection>
      </div>
    </ActionForm>
  );
}
