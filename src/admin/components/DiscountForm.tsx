"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  createDiscount,
  deleteDiscount,
  previewDiscount,
  updateDiscount,
} from "@backend/actions/discounts";
import type { DiscountFormOptions } from "@backend/data/discount-form";
import { useI18n } from "@admin/i18n/client";
import {
  instantFromInputs,
  scopeText,
  statusLine,
  valueText,
  type DiscountFormValues,
} from "@admin/lib/discount-view";
import { toneFor } from "@admin/lib/status";
import { ActionButton } from "@admin/ui/ActionButton";
import { ActionForm, useMarkDirty } from "@admin/ui/ActionForm";
import { Badge } from "@admin/ui/Badge";
import { Button, ButtonLink } from "@admin/ui/Button";
import { FormSection, Thumb } from "@admin/ui/Content";
import { Checkbox, Field, Input, PrefixInput, SearchInput, Switch } from "@admin/ui/Field";
import {
  CODE_MAX_LENGTH,
  MAX_DISCOUNT_PERCENT,
  SALE_LABEL_MAX,
  discountStatus,
  normaliseCode,
  saleUnitFils,
  type DiscountValueType,
  type SaleScope,
} from "@/lib/discounts";
import { useActivationConfirm, withActivationConfirm } from "./DiscountConfirm";

/**
 * The discount editor — one form for both kinds.
 *
 *   automatic sale   title · what customers see · value · applies to · dates
 *   discount code    code · value · minimum purchase · usage limits · dates
 *
 * with a Summary beside it that reads back, in sentences, what she has set.
 *
 * A DRAFT UNLESS SHE SAYS OTHERWISE. The Active switch is off on a new
 * discount. Saving with it on does not go live on that click: the server
 * refuses, this form shows what would change in numbers (DiscountConfirm),
 * and only her yes saves it active.
 *
 * THE BROWSER SENDS WHAT SHE TYPED, NEVER A PRICE IT WORKED OUT. Dirhams are
 * turned into fils and Abu Dhabi time into an instant on the server
 * (backend/domain/discount-form.ts). The sale prices shown beside the
 * products here are a preview from the same arithmetic the checkout uses.
 */

/* Unambiguous when read aloud or copied from a card: no 0/O, no 1/I. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const picks = new Uint32Array(8);
  crypto.getRandomValues(picks);
  return Array.from(picks, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}

/** Two or three choices side by side; one is always chosen. */
function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      <div className="inline-grid w-full grid-flow-col auto-cols-fr gap-1 rounded-md border border-line-strong bg-sunken p-1 sm:w-auto">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-sm px-4 text-sm text-ink-2 transition-colors duration-150 has-[:checked]:bg-surface has-[:checked]:font-medium has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus sm:min-h-9"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RadioRow({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name?: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-accent"
      />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

type Choice = { id: string; name: string; note?: ReactNode; thumbnailUrl?: string; showThumb?: boolean };

/**
 * A searchable checklist. What is ticked is submitted through hidden inputs,
 * so a row the search has filtered out of sight is still part of the save.
 */
function Checklist({
  name,
  items,
  selected,
  onToggle,
  searchLabel,
}: {
  name: string;
  items: readonly Choice[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  searchLabel?: string;
}) {
  const { t } = useI18n();
  const markDirty = useMarkDirty();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : items;

  return (
    <div className="min-w-0">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {searchLabel ? (
        <div className="mb-2">
          <label htmlFor={`${name}-search`} className="sr-only">
            {searchLabel}
          </label>
          <SearchInput
            id={`${name}-search`}
            value={query}
            placeholder={searchLabel}
            onChange={(e) => setQuery(e.target.value)}
            /* Searching is not editing: Enter must not save the discount. */
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </div>
      ) : null}
      <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-md border border-line">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-sm text-ink-3">{t("discounts.form.noneFound")}</li>
        ) : (
          shown.map((item) => (
            <li key={item.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-hover">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => {
                    onToggle(item.id);
                    markDirty();
                  }}
                  className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-accent"
                />
                {item.showThumb ? <Thumb shape="square" src={item.thumbnailUrl} alt="" className="h-10 w-10" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{item.name}</span>
                  {item.note ? <span className="block text-xs text-ink-3">{item.note}</span> : null}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
      <p className="mt-1.5 text-xs text-ink-3" aria-live="polite">
        {t("discounts.form.selected", { count: selected.size })}
      </p>
    </div>
  );
}

/** Fills the code box. A button press fires no input event, so it says so itself. */
function GenerateCode({ onPick }: { onPick: (code: string) => void }) {
  const { t } = useI18n();
  const markDirty = useMarkDirty();
  return (
    <Button
      className="shrink-0"
      onClick={() => {
        onPick(generateCode());
        markDirty();
      }}
    >
      {t("discounts.form.generate")}
    </Button>
  );
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function DiscountForm({
  values,
  options,
  performance,
}: {
  values: DiscountFormValues;
  options: DiscountFormOptions;
  /** Edit only: how it has been used, rendered by the page from real orders. */
  performance?: ReactNode;
}) {
  const i18n = useI18n();
  const { t, plural, money, date, label } = i18n;
  const { kind } = values;
  const discountId = values.id;
  const isEdit = typeof discountId === "number";
  const isSale = kind === "automatic";
  const { ask, dialog } = useActivationConfirm();

  const [labelEn, setLabelEn] = useState(values.labelEn);
  const [labelAr, setLabelAr] = useState(values.labelAr);
  const [code, setCode] = useState(values.code);
  const [valueType, setValueType] = useState<DiscountValueType>(values.valueType);
  const [percentOff, setPercentOff] = useState(values.percentOff);
  const [amountOffAed, setAmountOffAed] = useState(values.amountOffAed);
  const [appliesTo, setAppliesTo] = useState<SaleScope>(values.appliesTo);
  const [productIds, setProductIds] = useState<ReadonlySet<string>>(new Set(values.productIds));
  const [occasionIds, setOccasionIds] = useState<ReadonlySet<string>>(new Set(values.occasionIds));
  const [categories, setCategories] = useState<ReadonlySet<string>>(new Set(values.categories));
  const [startDate, setStartDate] = useState(values.startDate);
  const [startTime, setStartTime] = useState(values.startTime);
  const [hasEnd, setHasEnd] = useState(values.endDate !== "");
  const [endDate, setEndDate] = useState(values.endDate);
  const [endTime, setEndTime] = useState(values.endTime || "23:59");
  const [active, setActive] = useState(values.active);
  const [hasMinimum, setHasMinimum] = useState(values.minSubtotalAed !== "");
  const [minSubtotalAed, setMinSubtotalAed] = useState(values.minSubtotalAed);
  const [hasLimit, setHasLimit] = useState(values.usageLimit !== "");
  const [usageLimit, setUsageLimit] = useState(values.usageLimit);
  const [oncePerCustomer, setOncePerCustomer] = useState(values.oncePerCustomer);
  /* "Now", fixed when the form opens: enough to say draft / scheduled / live. */
  const [now] = useState(() => new Date());

  /* What she has typed, as the terms the pricing engine would read. */
  const percent = /^\d+$/.test(percentOff) ? Number(percentOff) : 0;
  const amountFils = /^\d+(\.\d{1,2})?$/.test(amountOffAed.trim())
    ? Math.round(Number(amountOffAed) * 100)
    : 0;
  const minimumFils =
    hasMinimum && /^\d+(\.\d{1,2})?$/.test(minSubtotalAed.trim())
      ? Math.round(Number(minSubtotalAed) * 100)
      : 0;
  const hasValue = valueType === "percentage" ? percent >= 1 && percent <= MAX_DISCOUNT_PERCENT : amountFils >= 100;
  const terms = {
    kind,
    valueType,
    percentOff: percent,
    amountOffFils: amountFils,
    appliesTo: isSale ? appliesTo : ("all" as const),
    productCount: productIds.size,
    occasionCount: occasionIds.size,
    categoryCount: categories.size,
    minSubtotalFils: minimumFils,
  };

  const startsAt = instantFromInputs(startDate, startTime);
  const endsAt = hasEnd ? instantFromInputs(endDate, endTime) : null;
  const status = discountStatus({ active, startsAt, endsAt }, now);

  const productPicks = useMemo<Choice[]>(
    () =>
      options.products.map((product) => {
        const salePrice = hasValue
          ? saleUnitFils(product.priceFils, { valueType, percentOff: percent, amountOffFils: amountFils })
          : product.priceFils;
        const lowered = salePrice < product.priceFils;
        return {
          id: product.id,
          name: product.name,
          thumbnailUrl: product.thumbnailUrl,
          showThumb: true,
          note: (
            <>
              <span dir="ltr" className={lowered ? "line-through" : undefined}>
                {money(product.priceFils)}
              </span>
              {lowered ? (
                <span className="ms-2 text-ink-2">
                  {t("discounts.form.salePrice", { price: money(salePrice) })}
                </span>
              ) : null}
              {product.available ? null : (
                <span className="ms-2">· {t("discounts.form.hiddenProduct")}</span>
              )}
            </>
          ),
        };
      }),
    [options.products, hasValue, valueType, percent, amountFils, money, t],
  );

  const save = (form: FormData) =>
    withActivationConfirm(
      (confirmed) => {
        /* Set only after she has read the confirmation and said yes. */
        if (confirmed) form.set("confirmActivation", "on");
        else form.delete("confirmActivation");
        return typeof discountId === "number" ? updateDiscount(discountId, form) : createDiscount(kind, form);
      },
      () => previewDiscount(kind, form),
      ask,
    );

  const datesCard = (
    <FormSection
      id="discount-dates"
      title={t("discounts.form.sections.dates")}
      description={t("discounts.form.timezoneHint")}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="startDate" label={t("discounts.form.startDate")}>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field id="startTime" label={t("discounts.form.startTime")}>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            value={startTime}
            disabled={startDate === ""}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs leading-relaxed text-ink-3">{t("discounts.form.startHint")}</p>

      <Checkbox
        label={t("discounts.form.setEndDate")}
        checked={hasEnd}
        onChange={(e) => setHasEnd(e.target.checked)}
      />
      {hasEnd ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="endDate" label={t("discounts.form.endDate")}>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
          <Field id="endTime" label={t("discounts.form.endTime")}>
            <Input
              id="endTime"
              name="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </FormSection>
  );

  const valueCard = (
    <FormSection id="discount-value" title={t("discounts.form.sections.value")}>
      <Segmented
        name="valueType"
        legend={t("discounts.form.valueType")}
        value={valueType}
        onChange={setValueType}
        options={[
          { value: "percentage", label: t("discounts.form.percentage") },
          { value: "fixed", label: t("discounts.form.fixed") },
        ]}
      />
      {valueType === "percentage" ? (
        <Field
          id="percentOff"
          label={t("discounts.form.percentOff")}
          required
          hint={`${t("discounts.form.percentHint")} ${isSale ? t("discounts.form.valueHintSale") : t("discounts.form.valueHintCode")}`}
        >
          <PrefixInput
            id="percentOff"
            name="percentOff"
            prefix="%"
            ltr
            withHint
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            value={percentOff}
            onChange={(e) => setPercentOff(e.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>
      ) : (
        <Field
          id="amountOffAed"
          label={t("discounts.form.amountOff")}
          required
          hint={isSale ? t("discounts.form.valueHintSale") : t("discounts.form.valueHintCode")}
        >
          <PrefixInput
            id="amountOffAed"
            name="amountOffAed"
            prefix="AED"
            ltr
            withHint
            inputMode="decimal"
            autoComplete="off"
            value={amountOffAed}
            onChange={(e) => setAmountOffAed(e.target.value)}
          />
        </Field>
      )}
    </FormSection>
  );

  const summary: string[] = [];
  if (hasValue) {
    const value = valueText(i18n, terms);
    summary.push(
      isSale
        ? t("discounts.summary.eachArrangement", { value })
        : t("discounts.summary.entireOrder", { value }),
    );
  }
  if (isSale) {
    summary.push(t("discounts.summary.appliesTo", { scope: scopeText(i18n, terms) }));
    summary.push(t("discounts.summary.addonsExcluded"));
  } else {
    if (minimumFils > 0) summary.push(t("discounts.summary.minimum", { amount: money(minimumFils) }));
    if (oncePerCustomer) summary.push(t("discounts.summary.oncePerCustomer"));
    if (hasLimit && /^\d+$/.test(usageLimit) && Number(usageLimit) > 0) {
      summary.push(plural("discounts.summary.limit", Number(usageLimit)));
    }
  }
  summary.push(
    startsAt
      ? t("discounts.summary.activeFrom", { date: date(startsAt, "datetime") })
      : t("discounts.summary.activeFromActivation"),
  );
  summary.push(endsAt ? t("discounts.summary.ends", { date: date(endsAt, "datetime") }) : t("discounts.noEndDate"));
  summary.push(isSale ? t("discounts.summary.noStack") : t("discounts.summary.stacksOnSale"));
  if (!isSale) summary.push(t("discounts.summary.noPaymentRequests"));

  return (
    <>
      <ActionForm
        action={save}
        submitLabel={isEdit ? undefined : t("discounts.form.save")}
        redirectTo={isEdit ? undefined : "/admin/discounts?created=1"}
        secondary={
          <ButtonLink href="/admin/discounts" variant="ghost">
            {t("common.cancel")}
          </ButtonLink>
        }
        destructive={
          typeof discountId === "number" ? (
            <ActionButton
              variant="danger"
              icon="trash"
              label={t("common.delete")}
              action={() => deleteDiscount(discountId)}
              redirectTo="/admin/discounts?deleted=1"
              confirm={{
                title: t("discounts.form.deleteTitle", { name: values.title }),
                body: t("discounts.form.deleteBody"),
                confirmLabel: t("discounts.form.deleteConfirm"),
              }}
            />
          ) : null
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="min-w-0 space-y-6">
            {isSale ? (
              <>
                <FormSection id="discount-title" title={t("discounts.form.sections.title")}>
                  <Field id="title" label={t("discounts.form.title")} required hint={t("discounts.form.titleHint")}>
                    <Input
                      id="title"
                      name="title"
                      withHint
                      required
                      maxLength={80}
                      defaultValue={values.title}
                      placeholder={t("discounts.form.titlePlaceholder")}
                    />
                  </Field>
                </FormSection>

                <FormSection
                  id="discount-customer"
                  title={t("discounts.form.sections.customer")}
                  description={t("discounts.form.labelHint")}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      id="labelEn"
                      label={t("discounts.form.labelEn")}
                      required
                      aside={`${labelEn.length}/${SALE_LABEL_MAX}`}
                    >
                      <Input
                        id="labelEn"
                        name="labelEn"
                        dir="ltr"
                        required
                        maxLength={SALE_LABEL_MAX}
                        value={labelEn}
                        placeholder="Eid offer"
                        onChange={(e) => setLabelEn(e.target.value)}
                      />
                    </Field>
                    <Field
                      id="labelAr"
                      label={t("discounts.form.labelAr")}
                      required
                      aside={`${labelAr.length}/${SALE_LABEL_MAX}`}
                    >
                      <Input
                        id="labelAr"
                        name="labelAr"
                        dir="rtl"
                        lang="ar"
                        required
                        maxLength={SALE_LABEL_MAX}
                        value={labelAr}
                        placeholder="عرض العيد"
                        onChange={(e) => setLabelAr(e.target.value)}
                      />
                    </Field>
                  </div>
                </FormSection>

                {valueCard}

                <FormSection id="discount-applies" title={t("discounts.form.sections.appliesTo")}>
                  <div role="radiogroup" aria-labelledby="discount-applies-title">
                    {(
                      [
                        ["all", t("discounts.form.allProducts")],
                        ["products", t("discounts.form.specificProducts")],
                        ["occasions", t("discounts.form.specificOccasions")],
                        ["categories", t("discounts.form.specificCategories")],
                      ] as const
                    ).map(([scope, text]) => (
                      <RadioRow
                        key={scope}
                        name="appliesTo"
                        value={scope}
                        checked={appliesTo === scope}
                        onChange={() => setAppliesTo(scope)}
                        label={text}
                      />
                    ))}
                  </div>
                  {appliesTo === "products" ? (
                    <Checklist
                      name="productIds"
                      items={productPicks}
                      selected={productIds}
                      onToggle={(id) => setProductIds((current) => toggled(current, id))}
                      searchLabel={t("discounts.form.searchProducts")}
                    />
                  ) : null}
                  {appliesTo === "occasions" ? (
                    <Checklist
                      name="occasionIds"
                      items={options.occasions}
                      selected={occasionIds}
                      onToggle={(id) => setOccasionIds((current) => toggled(current, id))}
                      searchLabel={options.occasions.length > 8 ? t("discounts.form.searchOccasions") : undefined}
                    />
                  ) : null}
                  {appliesTo === "categories" ? (
                    <Checklist
                      name="categories"
                      items={options.categories.map((c) => ({
                        id: c.value,
                        name: label("category", c.value) || c.label,
                      }))}
                      selected={categories}
                      onToggle={(id) => setCategories((current) => toggled(current, id))}
                    />
                  ) : null}
                </FormSection>
              </>
            ) : (
              <>
                <FormSection id="discount-code" title={t("discounts.form.sections.code")}>
                  <Field id="code" label={t("discounts.form.code")} required hint={t("discounts.form.codeHint")}>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="code"
                        name="code"
                        withHint
                        required
                        dir="ltr"
                        maxLength={CODE_MAX_LENGTH}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        value={code}
                        placeholder="EID10"
                        onChange={(e) => setCode(e.target.value)}
                        onBlur={() => setCode((current) => normaliseCode(current))}
                        className="min-w-0 flex-1 font-mono tracking-wide"
                      />
                      <GenerateCode onPick={setCode} />
                    </div>
                  </Field>
                  <Field
                    id="title"
                    label={t("discounts.form.internalName")}
                    hint={t("discounts.form.internalNameHint")}
                  >
                    <Input id="title" name="title" withHint maxLength={80} defaultValue={values.title} />
                  </Field>
                </FormSection>

                {valueCard}

                <FormSection
                  id="discount-minimum"
                  title={t("discounts.form.sections.minimum")}
                  description={t("discounts.form.minimumHint")}
                >
                  <div role="radiogroup" aria-labelledby="discount-minimum-title">
                    <RadioRow
                      value="none"
                      checked={!hasMinimum}
                      onChange={() => setHasMinimum(false)}
                      label={t("discounts.form.noMinimum")}
                    />
                    <RadioRow
                      value="amount"
                      checked={hasMinimum}
                      onChange={() => setHasMinimum(true)}
                      label={t("discounts.form.minimumAmount")}
                    />
                  </div>
                  {hasMinimum ? (
                    <Field id="minSubtotalAed" label={t("discounts.form.minimumAmount")}>
                      <PrefixInput
                        id="minSubtotalAed"
                        name="minSubtotalAed"
                        prefix="AED"
                        ltr
                        inputMode="decimal"
                        autoComplete="off"
                        value={minSubtotalAed}
                        onChange={(e) => setMinSubtotalAed(e.target.value)}
                      />
                    </Field>
                  ) : null}
                </FormSection>

                <FormSection id="discount-usage" title={t("discounts.form.sections.usage")}>
                  <Checkbox
                    label={t("discounts.form.limitTotal")}
                    checked={hasLimit}
                    onChange={(e) => setHasLimit(e.target.checked)}
                  />
                  {hasLimit ? (
                    <Field id="usageLimit" label={t("discounts.form.limitTotalValue")}>
                      <Input
                        id="usageLimit"
                        name="usageLimit"
                        dir="ltr"
                        inputMode="numeric"
                        autoComplete="off"
                        value={usageLimit}
                        onChange={(e) => setUsageLimit(e.target.value.replace(/[^\d]/g, ""))}
                        className="sm:max-w-40"
                      />
                    </Field>
                  ) : null}
                  <Checkbox
                    name="oncePerCustomer"
                    label={t("discounts.form.oncePerCustomer")}
                    hint={t("discounts.form.oncePerCustomerHint")}
                    checked={oncePerCustomer}
                    onChange={(e) => setOncePerCustomer(e.target.checked)}
                  />
                </FormSection>
              </>
            )}

            {datesCard}
          </div>

          {/* On a phone this column follows the fields, so the Summary and
              the Active switch are the last things above the save bar. */}
          <div className="min-w-0 space-y-6">
            <FormSection id="discount-summary" title={t("discounts.form.sections.summary")}>
              {isSale ? (
                <div>
                  <p className="mb-2 text-xs text-ink-3">{t("discounts.form.preview")}</p>
                  {/* The label as the storefront card wears it: light capitals
                      on the photograph's dark scrim, English and Arabic. */}
                  <div className="grid grid-cols-2 gap-2">
                    <span
                      dir="ltr"
                      className="flex min-h-14 items-start rounded-md bg-[#2b2f1b] p-2.5 text-[0.5625rem] font-medium uppercase leading-snug tracking-[0.18em] text-[#e4dcc5]"
                    >
                      <span className="break-words">{labelEn || "Eid offer"}</span>
                    </span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className="flex min-h-14 items-start rounded-md bg-[#2b2f1b] p-2.5 text-xs font-medium leading-snug text-[#e4dcc5]"
                    >
                      <span className="break-words">{labelAr || "عرض العيد"}</span>
                    </span>
                  </div>
                </div>
              ) : code ? (
                <p>
                  <span dir="ltr" className="inline-block rounded-sm border border-line-strong px-2 py-1 font-mono text-sm tracking-wide text-ink">
                    {normaliseCode(code)}
                  </span>
                </p>
              ) : null}
              <ul className="grid gap-2 text-sm leading-relaxed text-ink-2">
                {summary.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </FormSection>

            <FormSection id="discount-status" title={t("discounts.form.sections.status")}>
              <Switch
                name="active"
                label={t("discounts.form.active")}
                hint={values.active ? t("discounts.form.deactivateHint") : t("discounts.form.activeHint")}
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2" aria-live="polite">
                <Badge tone={toneFor("discountStatus", status)} dot={status === "active"}>
                  {label("discountStatus", status)}
                </Badge>
                <span className="min-w-0">{statusLine(i18n, status, startsAt)}</span>
              </div>
            </FormSection>

            {performance}
          </div>
        </div>
      </ActionForm>
      {dialog}
    </>
  );
}
