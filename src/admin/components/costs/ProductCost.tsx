"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { useMarkDirty } from "@admin/ui/ActionForm";
import { FormSection } from "@admin/ui/Content";
import { IconButton } from "@admin/ui/IconButton";
import { Icon } from "@admin/ui/icons";
import {
  COST_LIMITS,
  PERISHABLE,
  aedTextToFils,
  recipeCost,
  type CostEditorData,
  type CostItemRow,
  type ProductCostRecipe,
  type RecipeLine,
} from "@backend/domain/costs";
import { perUnitText } from "./cost-view";
import { ProductCostPicker } from "./ProductCostPicker";
import { ProductCostSummary } from "./ProductCostSummary";
import { Swatch } from "./Swatch";

/**
 * The product editor's Cost section: what goes into this arrangement, and
 * what it leaves her at its price. OWNER ONLY — ProductForm renders it only
 * when the page loaded `costEditor`, which the loader returns for the owner
 * alone, and the save action ignores `costRecipe` from anyone else.
 *
 * THE RECIPE SAVES WITH THE PRODUCT. It travels in one hidden `costRecipe`
 * field (JSON, the shape backend/domain/costs.ts `parseCostRecipe` reads), so
 * the product's own Save button saves both, for a new product as for an
 * existing one. Steppers do not fire input events, so they mark the form
 * changed themselves.
 *
 * Every figure is worked out here with the domain's `recipeCost`, from the
 * library's current cost of each item — the same function the server uses.
 */

/** Typed numbers as a florist types them: "1,5", Arabic-Indic digits, a stray space. */
function parseTyped(raw: string): number | null {
  const western = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫,]/g, ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(western)) return null;
  const value = Number(western);
  return Number.isFinite(value) ? value : null;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * − value + with 44px buttons. The value can also be typed: a draft is kept
 * while she types and only a number inside the bounds reaches the recipe, so
 * a half-typed "1." never becomes a quantity, and leaving the box shows the
 * real value again.
 */
function Stepper({
  value,
  onChange,
  min,
  max,
  step,
  label,
  lessLabel,
  moreLabel,
  suffix,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  /** The lowest value that can be typed or stepped to. */
  min: number;
  max: number;
  step: number;
  label: string;
  lessLabel: string;
  moreLabel: string;
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const set = (next: number) => {
    setDraft(null);
    onChange(round3(Math.min(max, Math.max(min, next))));
  };
  return (
    <div className="inline-flex h-11 shrink-0 items-center rounded-md border border-line-strong bg-field">
      <button
        type="button"
        aria-label={lessLabel}
        title={lessLabel}
        disabled={disabled || round3(value - step) < min}
        onClick={() => set(value - step)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-s-md text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="minus" className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          const typed = parseTyped(event.target.value);
          if (typed !== null && typed >= min && typed <= max) onChange(round3(typed));
        }}
        onBlur={() => setDraft(null)}
        className="h-full w-12 min-w-0 bg-transparent text-center text-base font-medium text-ink tabular focus:outline-none sm:text-sm"
      />
      {suffix ? <span className="-ms-1 pe-1 text-xs text-ink-3">{suffix}</span> : null}
      <button
        type="button"
        aria-label={moreLabel}
        title={moreLabel}
        disabled={disabled || round3(value + step) > max}
        onClick={() => set(value + step)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-e-md text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * One line of the recipe, laid out for a thumb first: in a narrow column (a
 * phone) the name and line cost share the top row, the stepper and "take
 * out" the second; once the recipe column is 24rem wide they sit on one row.
 * The breakpoint is the COLUMN's width (a container query), not the
 * screen's, because beside the summary on a laptop the column is narrower
 * than the screen suggests.
 */
const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 py-3 @[24rem]:grid-cols-[minmax(0,1fr)_auto_5.5rem_2.75rem]";
const UNORDER = "@[24rem]:order-none";

export function ProductCost({
  editor,
  priceAed,
  onUsePrice,
}: {
  editor: CostEditorData;
  /** The product form's own price field, as typed. */
  priceAed: string;
  /** Writes a price (in fils) into that field. */
  onUsePrice: (priceFils: number) => void;
}) {
  const i18n = useI18n();
  const { t, money } = i18n;
  const router = useRouter();
  const markDirty = useMarkDirty();
  const { settings } = editor;

  const [lines, setLines] = useState<RecipeLine[]>(editor.recipe?.lines ?? []);
  const [wastePercent, setWastePercent] = useState(editor.recipe?.wastePercent ?? settings.defaultWastePercent);
  const [makingMinutes, setMakingMinutes] = useState(editor.recipe?.makingMinutes ?? 0);

  const byId = useMemo(() => new Map(editor.items.map((item) => [item.id, item])), [editor.items]);
  const library = useMemo(() => editor.items.filter((item) => !item.archived), [editor.items]);
  const inRecipe = useMemo(() => new Set(lines.map((line) => line.itemId)), [lines]);

  const cost = recipeCost(lines, byId, {
    wastePercent,
    makingMinutes,
    labourRatePerHourFils: settings.labourRatePerHourFils,
  });
  const lineCost = new Map(cost.lines.map((line) => [line.itemId, line]));

  const typedPrice = aedTextToFils(priceAed);
  const priceFils = typedPrice !== null && Number.isFinite(typedPrice) ? Math.round(typedPrice) : null;

  /* An item deleted from the library entirely cannot be saved against; it is
     shown (so she knows) but left out of what Save sends. */
  const recipe: ProductCostRecipe = {
    lines: lines.filter((line) => byId.has(line.itemId)),
    wastePercent,
    makingMinutes,
  };

  /* She went to add a flower in another tab. When she comes back, read the
     library again — router.refresh() re-runs the page on the server and keeps
     everything typed here — so the new flower is in the picker. */
  const awaitingLibrary = useRef(false);
  useEffect(() => {
    const onFocus = () => {
      if (!awaitingLibrary.current) return;
      awaitingLibrary.current = false;
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const change = (update: () => void) => {
    update();
    markDirty();
  };
  const setQuantity = (itemId: number, quantity: number) =>
    change(() => setLines((current) => current.map((line) => (line.itemId === itemId ? { ...line, quantity } : line))));
  const removeLine = (itemId: number) => change(() => setLines((current) => current.filter((line) => line.itemId !== itemId)));
  const addItem = (item: CostItemRow) =>
    change(() =>
      setLines((current) =>
        current.some((line) => line.itemId === item.id) || current.length >= COST_LIMITS.recipeLinesMax
          ? current
          : [...current, { itemId: item.id, quantity: 1 }],
      ),
    );

  const perishableLines = lines.filter((line) => {
    const item = byId.get(line.itemId);
    return item !== undefined && PERISHABLE.has(item.kind);
  });
  const otherLines = lines.filter((line) => !perishableLines.includes(line));

  const renderLine = (line: RecipeLine) => {
    const item = byId.get(line.itemId);
    const name = item?.name ?? t("costs.product.unknownItem");
    const computed = lineCost.get(line.itemId);
    const missing = !item || item.archived || computed?.missing === true;
    const step = item?.useUnit === "metre" ? 0.5 : 1;
    return (
      <li key={line.itemId} className={ROW}>
        <div className={`order-1 flex min-w-0 items-center gap-3 ${UNORDER}`}>
          <Swatch color={item?.swatch} />
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-ink">{name}</p>
            {item && !missing ? (
              <p className="text-xs text-ink-3 tabular">{perUnitText(i18n, item.currentUnitCostFils, item.useUnit)}</p>
            ) : (
              <p className="flex items-start gap-1 text-xs leading-relaxed text-warning">
                <Icon name="alert" className="mt-px h-3.5 w-3.5" />
                {t("costs.product.missing")}
              </p>
            )}
          </div>
        </div>
        <div className={`order-3 ${UNORDER}`}>
          <Stepper
            value={line.quantity}
            onChange={(quantity) => setQuantity(line.itemId, quantity)}
            min={0.001}
            max={COST_LIMITS.quantityMax}
            step={step}
            label={t("costs.product.quantity", { name })}
            lessLabel={t("costs.product.less", { name })}
            moreLabel={t("costs.product.more", { name })}
          />
        </div>
        <span
          className={cn(
            `order-2 text-end text-sm font-medium tabular ${UNORDER}`,
            missing ? "text-ink-3" : "text-ink",
          )}
        >
          {money(computed?.lineFils ?? 0)}
        </span>
        <div className={`order-4 justify-self-end ${UNORDER}`}>
          <IconButton
            icon="trash"
            label={t("costs.product.remove", { name })}
            onClick={() => removeLine(line.itemId)}
            className="text-ink-3 hover:text-danger"
          />
        </div>
      </li>
    );
  };

  const group = (title: string, totalFils: number, groupLines: RecipeLine[]) =>
    groupLines.length > 0 ? (
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <span className="text-sm text-ink-2 tabular">{money(totalFils)}</span>
        </div>
        <ul className="divide-y divide-line">{groupLines.map(renderLine)}</ul>
      </div>
    ) : null;

  const lockNote = (
    <span className="inline-flex items-center gap-1.5">
      <Icon name="lock" className="h-3.5 w-3.5" />
      {t("costs.product.ownerOnly")}
    </span>
  );

  return (
    <FormSection id="product-cost" title={t("costs.product.title")} description={lockNote}>
      <input type="hidden" name="costRecipe" value={JSON.stringify(recipe)} />

      {library.length === 0 && lines.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-line-strong bg-sunken/50 px-4 py-5">
          <p className="max-w-md text-sm leading-relaxed text-ink-2">{t("costs.product.emptyLibrary")}</p>
          <a
            href="/admin/costs/items/new"
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              awaitingLibrary.current = true;
            }}
            className="-my-3 inline-flex items-center gap-1.5 py-3 text-sm font-medium text-ink underline underline-offset-4 hover:text-accent"
          >
            {t("costs.items.addFirst")}
            <Icon name="external" className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : (
        <div className="@container min-w-0">
          <div className="grid gap-6 @[42rem]:grid-cols-[minmax(0,1fr)_16rem] @[42rem]:items-start">
            <div className="@container min-w-0 space-y-5">
              {lines.length === 0 ? (
                <p className="text-sm leading-relaxed text-ink-3">{t("costs.product.emptyRecipe")}</p>
              ) : null}
              {group(t("costs.product.flowersGroup"), cost.perishableFils, perishableLines)}
              {group(t("costs.product.materialsGroup"), cost.otherFils, otherLines)}

              <ProductCostPicker
                items={library}
                inRecipe={inRecipe}
                onAdd={addItem}
                onOpenLibrary={() => {
                  awaitingLibrary.current = true;
                }}
              />

              <div className="divide-y divide-line border-t border-line">
                <div className={ROW}>
                  <div className={`order-1 min-w-0 ${UNORDER}`}>
                    <p className="text-sm font-medium text-ink">{t("costs.product.waste")}</p>
                    <p className="text-xs leading-relaxed text-ink-3">{t("costs.product.wasteHint")}</p>
                  </div>
                  <div className={`order-3 ${UNORDER}`}>
                    <Stepper
                      value={wastePercent}
                      onChange={(value) => change(() => setWastePercent(value))}
                      min={COST_LIMITS.wastePercent.min}
                      max={COST_LIMITS.wastePercent.max}
                      step={5}
                      suffix="%"
                      label={t("costs.product.wasteLabel")}
                      lessLabel={t("costs.product.wasteLess")}
                      moreLabel={t("costs.product.wasteMore")}
                    />
                  </div>
                  <span className={`order-2 text-end text-sm font-medium text-ink tabular ${UNORDER}`}>
                    {money(cost.wasteFils)}
                  </span>
                  <span aria-hidden className="order-4 hidden @[24rem]:block" />
                </div>
                <div className={ROW}>
                  <div className={`order-1 min-w-0 ${UNORDER}`}>
                    <p className="text-sm font-medium text-ink">{t("costs.product.making")}</p>
                    <p className="text-xs leading-relaxed text-ink-3">
                      {t("costs.product.makingHint", { rate: money(settings.labourRatePerHourFils) })}
                    </p>
                  </div>
                  <div className={`order-3 ${UNORDER}`}>
                    <Stepper
                      value={makingMinutes}
                      onChange={(value) => change(() => setMakingMinutes(Math.round(value)))}
                      min={COST_LIMITS.makingMinutes.min}
                      max={COST_LIMITS.makingMinutes.max}
                      step={5}
                      suffix={t("costs.product.minutes")}
                      label={t("costs.product.makingLabel")}
                      lessLabel={t("costs.product.makingLess")}
                      moreLabel={t("costs.product.makingMore")}
                    />
                  </div>
                  <span className={`order-2 text-end text-sm font-medium text-ink tabular ${UNORDER}`}>
                    {money(cost.labourFils)}
                  </span>
                  <span aria-hidden className="order-4 hidden @[24rem]:block" />
                </div>
              </div>
            </div>

            <ProductCostSummary
              priceFils={priceFils}
              costFils={cost.totalFils}
              settings={settings}
              onUsePrice={(fils) => change(() => onUsePrice(fils))}
            />
          </div>
        </div>
      )}
    </FormSection>
  );
}
