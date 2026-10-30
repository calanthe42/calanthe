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
  aedTextToFils,
  arrangementCost,
  westernDigits,
  type CostEditorData,
  type CostGroup,
  type CostItemRow,
  type ProductCostRecipe,
  type RecipeLine,
} from "@backend/domain/costs";
import { priceLineText } from "./cost-view";
import { ProductCostPicker } from "./ProductCostPicker";
import { ProductCostSummary } from "./ProductCostSummary";

/**
 * The product editor's Cost section: what goes into one of this arrangement
 * (florists call it a recipe), and what it leaves her at its price. OWNER
 * ONLY — ProductForm renders it only when the page loaded `costEditor`,
 * which the loader returns for the owner alone, and the save action ignores
 * `costRecipe` from anyone else.
 *
 * WHAT GOES IN SAVES WITH THE PRODUCT. It travels in one hidden `costRecipe`
 * field (JSON `{ lines: [{ itemId, quantity }] }`, the shape
 * backend/domain/costs.ts `parseCostRecipe` reads), so the product's own
 * Save button saves both, for a new product as for an existing one. The −
 * and + buttons do not fire input events, so they mark the form changed
 * themselves.
 *
 * Every figure is worked out here with the domain's `arrangementCost`, from
 * the latest price for one of each thing — the same function the server
 * uses. There is no allowance for lost flowers, no hourly rate and no VAT
 * taken out of the price: waste is measured elsewhere, her time is "before
 * your time", and the shop is not VAT-registered.
 */

/** Typed numbers as a florist types them: "1,5", Arabic-Indic digits, a stray space. */
function parseTyped(raw: string): number | null {
  const western = westernDigits(raw.trim()).replace(/,/g, ".");
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
        disabled={round3(value - step) < min}
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
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          const typed = parseTyped(event.target.value);
          if (typed !== null && typed >= min && typed <= max) onChange(round3(typed));
        }}
        onBlur={() => setDraft(null)}
        className="h-full w-12 min-w-0 bg-transparent text-center text-base font-medium text-ink tabular focus:outline-none sm:text-sm"
      />
      <button
        type="button"
        aria-label={moreLabel}
        title={moreLabel}
        disabled={round3(value + step) > max}
        onClick={() => set(value + step)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-e-md text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * One line, laid out for a thumb first: in a narrow column (a phone) the
 * name and line cost share the top row, the stepper and "take out" the
 * second; once the column is 24rem wide they sit on one row. The breakpoint
 * is the COLUMN's width (a container query), not the screen's, because
 * beside the summary on a laptop the column is narrower than the screen.
 */
const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 py-3 @[24rem]:grid-cols-[minmax(0,1fr)_auto_5.5rem_2.75rem]";
const UNORDER = "@[24rem]:order-none";

/** Flowers first, then packaging, then extras: the order she builds an arrangement in. */
const SECTIONS: { key: string; groups: readonly CostGroup[]; title: "flowersGroup" | "packagingGroup" | "extraGroup" }[] = [
  { key: "flowers", groups: ["flowers", "greenery"], title: "flowersGroup" },
  { key: "packaging", groups: ["packaging"], title: "packagingGroup" },
  { key: "extra", groups: ["extra"], title: "extraGroup" },
];

export function ProductCost({
  editor,
  priceAed,
}: {
  editor: CostEditorData;
  /** The product form's own price field, as typed. */
  priceAed: string;
}) {
  const i18n = useI18n();
  const { t, money } = i18n;
  const router = useRouter();
  const markDirty = useMarkDirty();

  const [lines, setLines] = useState<RecipeLine[]>(editor.recipe?.lines ?? []);

  const byId = useMemo(() => new Map(editor.items.map((item) => [item.id, item])), [editor.items]);
  const stillBought = useMemo(() => editor.items.filter((item) => !item.archived), [editor.items]);
  const inRecipe = useMemo(() => new Set(lines.map((line) => line.itemId)), [lines]);

  const cost = arrangementCost(lines, byId);
  const lineCost = new Map(cost.lines.map((line) => [line.itemId, line]));

  const typedPrice = aedTextToFils(priceAed);
  const priceFils = typedPrice !== null && Number.isFinite(typedPrice) ? Math.round(typedPrice) : null;

  /* Something deleted from What you buy entirely cannot be saved against; it
     is shown (so she knows) but left out of what Save sends. */
  const recipe: ProductCostRecipe = { lines: lines.filter((line) => byId.has(line.itemId)) };

  /* She went to add something in another tab. When she comes back, read the
     list again — router.refresh() re-runs the page on the server and keeps
     everything typed here — so the new thing is in the picker. */
  const awaitingList = useRef(false);
  useEffect(() => {
    const onFocus = () => {
      if (!awaitingList.current) return;
      awaitingList.current = false;
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

  const renderLine = (line: RecipeLine) => {
    const item = byId.get(line.itemId);
    const name = item?.name ?? t("costs.product.unknownItem");
    const lineFils = lineCost.get(line.itemId)?.lineFils ?? null;
    const step = item?.one === "metre" ? 0.5 : 1;
    return (
      <li key={line.itemId} className={ROW}>
        <div className={`order-1 min-w-0 ${UNORDER}`}>
          <p className="break-words text-sm font-medium text-ink">{name}</p>
          {item && item.priceForOneFils !== null ? (
            <p className="text-xs text-ink-3 tabular">{priceLineText(i18n, item)}</p>
          ) : (
            <p className="flex items-start gap-1 text-xs leading-relaxed text-warning">
              <Icon name="alert" className="mt-px h-3.5 w-3.5" />
              {t("costs.product.noPrice")}
            </p>
          )}
          {item?.archived ? <p className="text-xs text-ink-3">{t("costs.product.stopped")}</p> : null}
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
            lineFils === null ? "text-ink-3" : "text-ink",
          )}
        >
          {lineFils === null ? "—" : money(lineFils)}
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

  /* A line whose item left the list entirely has no group: it is shown with
     the flowers, so it is never out of sight. */
  const sectionOf = (line: RecipeLine): string => {
    const group = byId.get(line.itemId)?.group ?? "flowers";
    return SECTIONS.find((section) => section.groups.includes(group))?.key ?? "flowers";
  };

  return (
    <FormSection
      id="product-cost"
      title={t("costs.product.title")}
      description={
        <span className="inline-flex items-start gap-1.5">
          <Icon name="lock" className="mt-0.5 h-3.5 w-3.5" />
          {t("costs.product.description")}
        </span>
      }
    >
      <input type="hidden" name="costRecipe" value={JSON.stringify(recipe)} />

      {stillBought.length === 0 && lines.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-line-strong bg-sunken/50 px-4 py-5">
          <p className="max-w-md text-sm leading-relaxed text-ink-2">{t("costs.product.emptyList")}</p>
          <a
            href="/admin/costs/invoices/new"
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              awaitingList.current = true;
            }}
            className="-my-3 inline-flex items-center gap-1.5 py-3 text-sm font-medium text-ink underline underline-offset-4 hover:text-accent"
          >
            {t("costs.product.addInvoice")}
            <Icon name="external" className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : (
        <div className="@container min-w-0">
          <div className="grid gap-6 @[42rem]:grid-cols-[minmax(0,1fr)_17rem] @[42rem]:items-start">
            <div className="@container min-w-0 space-y-5">
              {lines.length === 0 ? (
                <p className="text-sm leading-relaxed text-ink-3">{t("costs.product.emptyRecipe")}</p>
              ) : null}
              {SECTIONS.map((section) => {
                const sectionLines = lines.filter((line) => sectionOf(line) === section.key);
                if (sectionLines.length === 0) return null;
                const totalFils = sectionLines.reduce((sum, line) => sum + (lineCost.get(line.itemId)?.lineFils ?? 0), 0);
                return (
                  <div key={section.key} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                      <h3 className="text-sm font-semibold text-ink">{t(`costs.product.${section.title}`)}</h3>
                      <span className="text-sm text-ink-2 tabular">{money(totalFils)}</span>
                    </div>
                    <ul className="divide-y divide-line">{sectionLines.map(renderLine)}</ul>
                  </div>
                );
              })}

              <ProductCostPicker
                items={stillBought}
                inRecipe={inRecipe}
                onAdd={addItem}
                onOpenNew={() => {
                  awaitingList.current = true;
                }}
              />
            </div>

            <ProductCostSummary priceFils={priceFils} cost={cost} hasLines={lines.length > 0} />
          </div>
        </div>
      )}
    </FormSection>
  );
}
