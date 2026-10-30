"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { ActionButton } from "@admin/ui/ActionButton";
import { UnsavedChangesGuard } from "@admin/ui/ActionForm";
import { Button, ButtonLink } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { Field, Input, PrefixInput, Select, fieldClasses } from "@admin/ui/Field";
import { IconButton } from "@admin/ui/IconButton";
import { Icon } from "@admin/ui/icons";
import { useAction } from "@admin/ui/useAction";
import { deleteInvoice, saveInvoice } from "@backend/actions/costs";
import {
  COST_GROUPS,
  ONE_UNITS,
  aedTextToFils,
  invoiceExtrasFils,
  invoicePricesForOne,
  invoiceTotalsCheck,
  invoiceUnits,
  matchItem,
  priceChangePercent,
  westernDigits,
  type CostGroup,
  type CostItemRow,
  type InvoiceDetail,
  type InvoiceInput,
  type InvoiceResult,
  type OneUnit,
  type PriceChange,
  type SupplierRow,
} from "@backend/domain/costs";
import { PACK_NAMES, countText, filsToAedInput, packNameOf, perOneText, type PackName } from "./cost-view";

/**
 * Add an invoice, or change one: what she bought, line by line, written as
 * the sentence she would say —
 *
 *   [Peach Avalanche rose ▾]
 *   [5] bunches of [20] stems for AED [300]  → AED 3.23 a stem
 *
 * — with the price for one worked out live, by the same domain arithmetic
 * the server stores (backend/domain/costs.ts): delivery and, while the shop
 * is not VAT-registered, supplier VAT shared over the lines by value.
 *
 * Something not in What you buy yet is simply typed: the line then asks the
 * one question that matters — flowers, greenery, packaging or something
 * extra — and how it comes. When the name looks like something she already
 * buys (the wholesaler's "ROSE PEACH AVAL 50CM"), one tap says "the same",
 * and the printed name is learned so next time it matches by itself.
 *
 * ONE SAVE. It stays off until every line is answered, and says why. After
 * saving, "What changed" lists every price that moved, in dirhams. A
 * duplicate invoice is refused by the server with a sentence naming the
 * day it was added; the field it is about is marked.
 *
 * Typed for now; reading a photo of the invoice is Release 2.
 */

type LineDraft = {
  key: string;
  itemId: number | null;
  /** The name as typed: a search for something she buys, or the name of something new. */
  query: string;
  /** The wholesaler's name, learned when she says it is the same as something she buys. */
  printedName: string | null;
  group: CostGroup | null;
  pack: PackName;
  one: OneUnit;
  packs: string;
  unitsPerPack: string;
  lineTotal: string;
};

/** "5", "0.5", "٥" — a positive number, or null. */
function typedNumber(raw: string): number | null {
  const cleaned = westernDigits(raw).replace(/[\s,]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** An AED amount that may be left empty: the fils, 0 for empty, or null when it is not a number. */
function optionalFils(raw: string): number | null {
  const fils = aedTextToFils(raw);
  if (fils === null) return 0;
  return Number.isFinite(fils) ? Math.round(fils) : null;
}

function blankLine(key: string): LineDraft {
  return {
    key,
    itemId: null,
    query: "",
    printedName: null,
    group: null,
    pack: "bunch",
    one: "stem",
    packs: "",
    unitsPerPack: "",
    lineTotal: "",
  };
}

const amountText = (fils: number) => (fils === 0 ? "0" : filsToAedInput(fils));

/** The sentence's inline controls: a phone-sized tap target that sits in a line of words. */
const INLINE = cn(fieldClasses, "w-auto");

/* ------------------------------------------------------------------ */
/* What a line is: something she buys, or something new                */
/* ------------------------------------------------------------------ */

function ItemField({
  line,
  index,
  items,
  invalid,
  onPick,
  onType,
  onSame,
}: {
  line: LineDraft;
  index: number;
  items: CostItemRow[];
  invalid: boolean;
  onPick: (item: CostItemRow) => void;
  onType: (query: string) => void;
  /** She says the typed name is this thing: the typed name is learned as its printed name. */
  onSame: (item: CostItemRow) => void;
}) {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const baseId = useId();
  const inputId = `${baseId}-what`;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const words = line.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const shown =
    line.itemId !== null || words.length === 0
      ? []
      : items
          .filter((item) => {
            const haystack = [item.name, ...item.aliases].join(" ").toLocaleLowerCase();
            return words.every((word) => haystack.includes(word));
          })
          .slice(0, 8);
  const expanded = open && shown.length > 0;
  const activeItem = shown[Math.min(active, shown.length - 1)];

  /* No word-for-word match: is it what she already buys under another
     name? matchItem refuses anything under half the words in common. */
  const suggestion = useMemo(() => {
    if (line.itemId !== null || shown.length > 0 || line.query.trim().length < 3) return null;
    const match = matchItem(
      line.query,
      items.map((item) => ({ id: item.id, name: item.name, aliases: item.aliases })),
    );
    return match ? (items.find((item) => item.id === match.id) ?? null) : null;
  }, [items, line.itemId, line.query, shown.length]);

  const pick = (item: CostItemRow) => {
    onPick(item);
    setOpen(false);
    setActive(0);
  };

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (expanded && activeItem) pick(activeItem);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && shown.length > 0) {
      event.preventDefault();
      setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (Math.min(current, shown.length - 1) + delta + shown.length) % shown.length);
    }
  }

  return (
    <div className="min-w-0">
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <Icon
          name={line.itemId !== null ? "check" : "search"}
          className={cn(
            "pointer-events-none absolute start-3 top-[1.375rem] h-4 w-4 -translate-y-1/2",
            line.itemId !== null ? "text-success" : "text-ink-3",
          )}
        />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeItem ? `${baseId}-option-${activeItem.id}` : undefined}
          aria-invalid={invalid || undefined}
          aria-label={`${t("costs.invoice.line", { number: index + 1 })}: ${t("costs.invoice.what")}`}
          autoComplete="off"
          dir="auto"
          enterKeyHint="next"
          placeholder={t("costs.invoice.whatPlaceholder")}
          value={line.query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onType(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(fieldClasses, "ps-9 font-medium")}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={t("costs.invoice.what")}
          hidden={!expanded}
          className="mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-line bg-raised p-1 shadow-card"
        >
          {shown.map((item) => (
            <li
              key={item.id}
              id={`${baseId}-option-${item.id}`}
              role="option"
              aria-selected={activeItem?.id === item.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(item)}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col justify-center rounded-sm px-3 py-1.5 text-sm text-ink hover:bg-hover",
                activeItem?.id === item.id && "bg-hover",
              )}
            >
              <span className="truncate font-medium">{item.name}</span>
              <span className="text-xs text-ink-3">{t(`costs.group.${item.group}`)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p aria-live="polite" className="sr-only">
        {open && words.length > 0 && line.itemId === null ? plural("costs.invoice.results", shown.length) : ""}
      </p>
      {suggestion ? (
        <button
          type="button"
          onClick={() => onSame(suggestion)}
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink transition-colors duration-150 hover:bg-hover"
        >
          <Icon name="check" className="h-4 w-4 text-ink-3" />
          {t("costs.invoice.sameAs", { name: suggestion.name })}
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What changed                                                        */
/* ------------------------------------------------------------------ */

function changeText(i18n: ReturnType<typeof useI18n>, change: PriceChange): { text: string; up: boolean } {
  const { t, money } = i18n;
  const now = perOneText(i18n, change.nowFils, change.one);
  const percent = priceChangePercent(change.beforeFils, change.nowFils);
  if (change.beforeFils === null || percent === null) {
    return { text: t("costs.invoice.changed.first", { name: change.name, now }), up: false };
  }
  if (percent > 0) {
    return {
      text: t("costs.invoice.changed.up", { name: change.name, before: money(change.beforeFils), now, percent }),
      up: true,
    };
  }
  if (percent < 0) {
    return {
      text: t("costs.invoice.changed.down", {
        name: change.name,
        before: money(change.beforeFils),
        now,
        percent: Math.abs(percent),
      }),
      up: false,
    };
  }
  return { text: t("costs.invoice.changed.same", { name: change.name, now }), up: false };
}

function WhatChanged({
  changes,
  onAnother,
  isEdit,
}: {
  changes: PriceChange[];
  onAnother: () => void;
  isEdit: boolean;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  return (
    <section
      aria-labelledby="invoice-changed-title"
      className="rounded-md border border-success/30 bg-surface p-4 shadow-card sm:p-5"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <Icon name="checkCircle" className="h-4 w-4" />
        {t("costs.invoice.saved")}
      </p>
      <h2 id="invoice-changed-title" className="mt-3 text-[15px] font-semibold text-ink">
        {t("costs.invoice.changed.title")}
      </h2>
      {changes.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">{t("costs.invoice.changed.none")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {changes.map((change) => {
            const { text, up } = changeText(i18n, change);
            return (
              <li key={change.itemId} className="flex items-start gap-2 py-2.5 text-sm text-ink tabular">
                <Icon
                  name={up ? "trendUp" : "check"}
                  className={cn("mt-0.5 h-4 w-4", up ? "text-warning" : "text-ink-3")}
                />
                <span className="min-w-0">{text}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {isEdit ? (
          <ButtonLink href="/admin/costs/invoices/new" variant="primary" icon="plus">
            {t("costs.invoice.addAnother")}
          </ButtonLink>
        ) : (
          <Button variant="primary" icon="plus" onClick={onAnother}>
            {t("costs.invoice.addAnother")}
          </Button>
        )}
        <ButtonLink href="/admin/costs/invoices">{t("costs.invoice.seeInvoices")}</ButtonLink>
        <ButtonLink href="/admin/costs" variant="ghost">
          {t("costs.invoice.seeMoney")}
        </ButtonLink>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

export function InvoiceEditor({
  invoice,
  suppliers,
  items,
  today,
  vatRegistered,
}: {
  /** The invoice being changed, or null for a new one. */
  invoice: InvoiceDetail | null;
  suppliers: SupplierRow[];
  /** Everything she buys, including what she no longer buys (only offered when this invoice has it). */
  items: CostItemRow[];
  /** YYYY-MM-DD in the UAE. */
  today: string;
  vatRegistered: boolean;
}) {
  const i18n = useI18n();
  const { t, plural, money } = i18n;
  const { state, error, run } = useAction();
  const topRef = useRef<HTMLDivElement>(null);
  const isEdit = invoice !== null;

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const offered = useMemo(() => {
    const onThis = new Set((invoice?.lines ?? []).map((line) => line.itemId));
    return items.filter((item) => !item.archived || onThis.has(item.id));
  }, [items, invoice]);

  /* Keys the server and the browser agree on (they become element ids), then
     a counter for lines she adds. */
  const added = useRef(0);
  const freshKey = () => `added-${(added.current += 1)}`;
  const initialLines = (): LineDraft[] =>
    invoice && invoice.lines.length > 0
      ? invoice.lines.map((line, index) => {
          const item = byId.get(line.itemId);
          return {
            key: `saved-${index}`,
            itemId: line.itemId,
            query: line.name || item?.name || "",
            printedName: line.printedName,
            group: line.group,
            pack: packNameOf(item?.packName) ?? "bunch",
            one: line.one,
            packs: String(line.packs),
            unitsPerPack: String(line.unitsPerPack),
            lineTotal: amountText(line.lineTotalFils),
          };
        })
      : [blankLine("first")];

  const [supplierChoice, setSupplierChoice] = useState<string>(
    invoice ? String(invoice.supplier.id) : suppliers.length === 0 ? "new" : "",
  );
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoiceDate ?? today);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber ?? "");
  const [lines, setLines] = useState<LineDraft[]>(initialLines);
  const [delivery, setDelivery] = useState(invoice ? amountText(invoice.deliveryFils) : "");
  const [vat, setVat] = useState(invoice ? amountText(invoice.vatFils) : "");
  const [total, setTotal] = useState(invoice?.totalFils != null ? amountText(invoice.totalFils) : "");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<PriceChange[] | null>(null);
  const [badField, setBadField] = useState<string | null>(null);

  const touch = () => {
    setDirty(true);
    setBadField(null);
  };
  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    touch();
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  /* ---- The arithmetic, live ---- */
  const deliveryFils = optionalFils(delivery);
  const vatFils = optionalFils(vat);
  const totalFils = total.trim() === "" ? null : optionalFils(total);
  const computed = lines.map((line) => {
    const item = line.itemId !== null ? byId.get(line.itemId) : undefined;
    const single = (item ? packNameOf(item.packName) : line.pack) === "single";
    const packs = typedNumber(line.packs);
    const perPack = single ? 1 : typedNumber(line.unitsPerPack);
    const lineFils = line.lineTotal.trim() === "" ? null : optionalFils(line.lineTotal);
    const units = packs !== null && perPack !== null ? invoiceUnits(packs, perPack) : 0;
    return { packs, perPack, lineFils, units };
  });
  const prices = invoicePricesForOne(
    computed.map((line) => ({ lineTotalFils: line.lineFils ?? 0, units: line.units })),
    invoiceExtrasFils(deliveryFils ?? 0, vatFils ?? 0, vatRegistered),
  );
  const check = invoiceTotalsCheck(
    computed.map((line) => line.lineFils ?? 0),
    deliveryFils ?? 0,
    vatFils ?? 0,
    totalFils,
  );

  /* ---- Ready to save? Every line answered, every amount a number. ---- */
  const supplierReady =
    supplierChoice === "new" ? supplierName.trim().length > 0 : /^\d+$/.test(supplierChoice);
  const lineReady = (line: LineDraft, index: number) => {
    const c = computed[index];
    const what = line.itemId !== null || (line.query.trim().length > 0 && line.group !== null);
    return Boolean(what && c && c.packs !== null && c.perPack !== null && c.lineFils !== null);
  };
  const ready =
    supplierReady &&
    /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) &&
    lines.length > 0 &&
    lines.every(lineReady) &&
    deliveryFils !== null &&
    vatFils !== null &&
    (total.trim() === "" || totalFils !== null);

  function input(): InvoiceInput {
    /* A "new" supplier she already has, whatever its case, is that supplier. */
    const typed = supplierName.trim().replace(/\s+/g, " ");
    const existing = suppliers.find((supplier) => supplier.name.toLocaleLowerCase() === typed.toLocaleLowerCase());
    const supplier =
      supplierChoice === "new" ? (existing ? { id: existing.id } : { name: typed }) : { id: Number(supplierChoice) };
    return {
      ...(invoice ? { id: invoice.id } : {}),
      supplier,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      deliveryAed: delivery.trim(),
      vatAed: vat.trim(),
      totalAed: total.trim(),
      lines: lines.map((line, index) => {
        const c = computed[index]!;
        const perPack = c.perPack ?? 1;
        return {
          itemId: line.itemId,
          ...(line.itemId === null
            ? {
                newItem: {
                  name: line.query.trim().replace(/\s+/g, " "),
                  group: line.group ?? "flowers",
                  packName: line.pack,
                  unitsPerPack: perPack,
                  one: line.one,
                },
              }
            : {}),
          ...(line.printedName ? { printedName: line.printedName } : {}),
          packs: c.packs ?? 0,
          unitsPerPack: perPack,
          lineTotalAed: line.lineTotal.trim(),
        };
      }),
    };
  }

  function save() {
    if (!ready || state === "saving") return;
    void run<InvoiceResult>(() => saveInvoice(input()), {
      onSuccess: (result) => {
        if (!result.ok) return;
        setDirty(false);
        setSaved(result.changes);
        topRef.current?.scrollIntoView({ block: "start" });
      },
      onFailure: (result) => {
        if (result && !result.ok) setBadField(result.field ?? null);
      },
    });
  }

  function another() {
    setSupplierChoice(suppliers.length === 0 ? "new" : supplierChoice === "new" ? "" : supplierChoice);
    setSupplierName("");
    setInvoiceDate(today);
    setInvoiceNumber("");
    setLines([blankLine(freshKey())]);
    setDelivery("");
    setVat("");
    setTotal("");
    setSaved(null);
    setDirty(false);
    setBadField(null);
    topRef.current?.scrollIntoView({ block: "start" });
  }

  const lineInvalid = (index: number, part?: string) =>
    badField !== null && (badField === `lines.${index}.${part ?? ""}` || (!part && badField.startsWith(`lines.${index}.`)));

  if (saved) {
    return (
      <div ref={topRef} className="scroll-mt-24">
        <WhatChanged changes={saved} onAnother={another} isEdit={isEdit} />
      </div>
    );
  }

  const supplierOptions = [
    ...suppliers.map((supplier) => ({ value: String(supplier.id), label: supplier.name })),
    { value: "new", label: t("costs.invoice.supplierNew") },
  ];
  const tomorrow = (() => {
    const at = new Date(`${today}T00:00:00Z`);
    at.setUTCDate(at.getUTCDate() + 1);
    return at.toISOString().slice(0, 10);
  })();

  return (
    <div ref={topRef} className="min-w-0 scroll-mt-24 space-y-6">
      <FormSection id="invoice-about" title={t("costs.invoice.about")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-3">
            {suppliers.length > 0 ? (
              <Field id="invoice-supplier" label={t("costs.invoice.supplier")} required>
                <Select
                  id="invoice-supplier"
                  value={supplierChoice}
                  invalid={badField === "supplier"}
                  placeholder={supplierChoice === "" ? t("costs.invoice.supplierChoose") : undefined}
                  options={supplierOptions}
                  onChange={(event) => {
                    touch();
                    setSupplierChoice(event.target.value);
                  }}
                />
              </Field>
            ) : null}
            {supplierChoice === "new" ? (
              <Field
                id="invoice-supplier-name"
                label={suppliers.length > 0 ? t("costs.invoice.supplierName") : t("costs.invoice.supplier")}
                required
              >
                <Input
                  id="invoice-supplier-name"
                  value={supplierName}
                  invalid={badField === "supplier"}
                  maxLength={80}
                  autoComplete="off"
                  dir="auto"
                  placeholder={t("costs.invoice.supplierNamePlaceholder")}
                  onChange={(event) => {
                    touch();
                    setSupplierName(event.target.value);
                  }}
                />
              </Field>
            ) : null}
          </div>
          <Field id="invoice-date" label={t("costs.invoice.date")} required>
            <Input
              id="invoice-date"
              type="date"
              value={invoiceDate}
              max={tomorrow}
              invalid={badField === "invoiceDate"}
              onChange={(event) => {
                touch();
                setInvoiceDate(event.target.value);
              }}
              className="tabular"
            />
          </Field>
          <Field id="invoice-number" label={t("costs.invoice.number")} hint={t("costs.invoice.numberHint")}>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              withHint
              invalid={badField === "invoiceNumber"}
              maxLength={60}
              autoComplete="off"
              dir="ltr"
              onChange={(event) => {
                touch();
                setInvoiceNumber(event.target.value);
              }}
              className="tabular"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection id="invoice-lines" title={t("costs.invoice.bought")} description={t("costs.invoice.boughtHint")}>
        <ol className="grid gap-4">
          {lines.map((line, index) => {
            const c = computed[index]!;
            const item = line.itemId !== null ? byId.get(line.itemId) : undefined;
            const isNew = line.itemId === null && line.query.trim().length > 0;
            const pack: PackName | null = item ? packNameOf(item.packName) : line.pack;
            const one: OneUnit = item?.one ?? line.one;
            const single = pack === "single";
            const price = prices[index] ?? 0;
            const showPrice = c.units > 0 && c.lineFils !== null;
            const packCount = c.packs ?? 2;
            const lineLabel = t("costs.invoice.line", { number: index + 1 });
            return (
              <li
                key={line.key}
                className={cn(
                  "min-w-0 rounded-md border bg-surface p-3 sm:p-4",
                  lineInvalid(index) ? "border-danger" : "border-line",
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-3">{lineLabel}</span>
                  {lines.length > 1 ? (
                    <IconButton
                      icon="trash"
                      label={t("costs.invoice.removeLine", { number: index + 1 })}
                      onClick={() => {
                        touch();
                        setLines((current) => current.filter((other) => other.key !== line.key));
                      }}
                      className="-my-2 text-ink-3 hover:text-danger"
                    />
                  ) : null}
                </div>

                <ItemField
                  line={line}
                  index={index}
                  items={offered}
                  invalid={lineInvalid(index, "item") || badField?.startsWith(`lines.${index}.newItem.name`) === true}
                  onType={(query) => {
                    const exact = offered.find(
                      (other) => other.name.toLocaleLowerCase() === query.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
                    );
                    updateLine(line.key, {
                      query,
                      itemId: exact?.id ?? null,
                      printedName: null,
                      ...(exact ? { unitsPerPack: String(exact.unitsPerPack), group: exact.group } : {}),
                    });
                  }}
                  onPick={(picked) =>
                    updateLine(line.key, {
                      itemId: picked.id,
                      query: picked.name,
                      printedName: null,
                      group: picked.group,
                      unitsPerPack: String(picked.unitsPerPack),
                    })
                  }
                  onSame={(picked) =>
                    updateLine(line.key, {
                      itemId: picked.id,
                      printedName: line.query.trim(),
                      query: picked.name,
                      group: picked.group,
                      unitsPerPack: String(picked.unitsPerPack),
                    })
                  }
                />
                {line.printedName ? (
                  <p className="mt-1.5 text-xs text-ink-3" dir="auto">
                    {line.printedName}
                  </p>
                ) : null}

                {isNew ? (
                  <fieldset className="mt-3 min-w-0">
                    <legend className="mb-2 text-sm font-medium text-ink">{t("costs.invoice.newThing")}</legend>
                    <div className="flex flex-wrap gap-2">
                      {COST_GROUPS.map((value) => (
                        <label
                          key={value}
                          className={cn(
                            "inline-flex min-h-11 cursor-pointer items-center rounded-md border px-3 text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                            line.group === value
                              ? "border-ink bg-ink text-page"
                              : cn(
                                  "bg-surface text-ink-2 hover:bg-hover hover:text-ink",
                                  lineInvalid(index, "newItem.group") ? "border-danger" : "border-line-strong",
                                ),
                          )}
                        >
                          <input
                            type="radio"
                            name={`${line.key}-group`}
                            value={value}
                            checked={line.group === value}
                            onChange={() =>
                              updateLine(line.key, {
                                group: value,
                                /* Packaging and extras come one piece at a time; ribbon she changes to metres. */
                                ...(value === "flowers" || value === "greenery"
                                  ? { one: "stem" as const }
                                  : { one: "piece" as const }),
                              })
                            }
                            className="sr-only"
                          />
                          {t(`costs.group.${value}`)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {/* "[5] bunches of [20] stems for AED [300]": a line of words
                    and boxes that wraps on a phone. */}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-ink-2">
                  <input
                    aria-label={`${lineLabel}: ${t("costs.invoice.packs")}`}
                    aria-invalid={lineInvalid(index, "packs") || undefined}
                    inputMode="decimal"
                    autoComplete="off"
                    value={line.packs}
                    placeholder="5"
                    onChange={(event) => updateLine(line.key, { packs: event.target.value })}
                    className={cn(INLINE, "w-16 text-center tabular")}
                  />
                  {item ? (
                    <span>
                      {pack ? plural(`costs.packWord.${pack}`, packCount) : (item.packName ?? "")}
                    </span>
                  ) : (
                    <select
                      aria-label={`${lineLabel}: ${t("costs.invoice.packKind")}`}
                      value={line.pack}
                      onChange={(event) => {
                        const next = event.target.value as PackName;
                        updateLine(line.key, { pack: next, ...(next === "single" ? { unitsPerPack: "1" } : {}) });
                      }}
                      className={cn(INLINE, "cursor-pointer pe-8")}
                    >
                      {PACK_NAMES.map((value) => (
                        <option key={value} value={value}>
                          {plural(`costs.packWord.${value}`, packCount)}
                        </option>
                      ))}
                    </select>
                  )}
                  {single ? null : (
                    <>
                      <span>{t("costs.invoice.of")}</span>
                      <input
                        aria-label={`${lineLabel}: ${t("costs.invoice.perPack")}`}
                        aria-invalid={lineInvalid(index, "unitsPerPack") || undefined}
                        inputMode="decimal"
                        autoComplete="off"
                        value={line.unitsPerPack}
                        placeholder="20"
                        onChange={(event) => updateLine(line.key, { unitsPerPack: event.target.value })}
                        className={cn(INLINE, "w-16 text-center tabular")}
                      />
                    </>
                  )}
                  {item ? (
                    <span>{plural(`costs.oneWord.${one}`, single ? packCount : (c.perPack ?? 2))}</span>
                  ) : (
                    <select
                      aria-label={`${lineLabel}: ${t("costs.invoice.oneKind")}`}
                      value={line.one}
                      onChange={(event) => updateLine(line.key, { one: event.target.value as OneUnit })}
                      className={cn(INLINE, "cursor-pointer pe-8")}
                    >
                      {ONE_UNITS.map((value) => (
                        <option key={value} value={value}>
                          {plural(`costs.oneWord.${value}`, single ? packCount : (c.perPack ?? 2))}
                        </option>
                      ))}
                    </select>
                  )}
                  <span>{t("costs.invoice.for")}</span>
                  <span className="w-32">
                    <PrefixInput
                      id={`${line.key}-total`}
                      prefix="AED"
                      aria-label={`${lineLabel}: ${t("costs.invoice.lineTotal")}`}
                      invalid={lineInvalid(index, "lineTotalAed")}
                      inputMode="decimal"
                      autoComplete="off"
                      value={line.lineTotal}
                      placeholder="300"
                      onChange={(event) => updateLine(line.key, { lineTotal: event.target.value })}
                      className="tabular"
                    />
                  </span>
                </div>

                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm tabular" aria-live="polite">
                  {showPrice ? (
                    <>
                      <span className="text-ink-3">{countText(i18n, c.units, one)}</span>
                      <Icon name="arrowRight" className="h-4 w-4 text-ink-3" />
                      <span className="font-semibold text-ink">{perOneText(i18n, price, one)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-3">{t("costs.invoice.resultPending")}</span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            icon="plus"
            onClick={() => {
              touch();
              setLines((current) => [...current, blankLine(freshKey())]);
            }}
          >
            {t("costs.invoice.addLine")}
          </Button>
        </div>
      </FormSection>

      <FormSection
        id="invoice-extras"
        title={t("costs.invoice.extras")}
        description={vatRegistered ? t("costs.invoice.extrasHintVat") : t("costs.invoice.extrasHint")}
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="invoice-delivery" label={t("costs.invoice.delivery")}>
            <PrefixInput
              id="invoice-delivery"
              prefix="AED"
              inputMode="decimal"
              autoComplete="off"
              value={delivery}
              invalid={deliveryFils === null || badField === "deliveryAed"}
              placeholder="0"
              onChange={(event) => {
                touch();
                setDelivery(event.target.value);
              }}
              className="tabular"
            />
          </Field>
          <Field id="invoice-vat" label={t("costs.invoice.vat")}>
            <PrefixInput
              id="invoice-vat"
              prefix="AED"
              inputMode="decimal"
              autoComplete="off"
              value={vat}
              invalid={vatFils === null || badField === "vatAed"}
              placeholder="0"
              onChange={(event) => {
                touch();
                setVat(event.target.value);
              }}
              className="tabular"
            />
          </Field>
          <Field id="invoice-total" label={t("costs.invoice.total")} hint={t("costs.invoice.totalHint")}>
            <PrefixInput
              id="invoice-total"
              prefix="AED"
              withHint
              inputMode="decimal"
              autoComplete="off"
              value={total}
              invalid={(total.trim() !== "" && totalFils === null) || badField === "totalAed"}
              onChange={(event) => {
                touch();
                setTotal(event.target.value);
              }}
              className="tabular"
            />
          </Field>
        </div>
        <p
          aria-live="polite"
          className={cn(
            "flex items-start gap-2 rounded-md px-3 py-2.5 text-sm leading-relaxed",
            check.matches === false ? "bg-warning/[0.08] text-ink" : "bg-sunken/60 text-ink-2",
          )}
        >
          <Icon
            name={check.matches === false ? "alert" : check.matches ? "checkCircle" : "info"}
            className={cn(
              "mt-0.5 h-4 w-4",
              check.matches === false ? "text-warning" : check.matches ? "text-success" : "text-ink-3",
            )}
          />
          <span className="tabular">
            {check.matches === null
              ? t("costs.invoice.check.noTotal", { sum: money(check.sumFils) })
              : check.matches
                ? t("costs.invoice.check.matches", { sum: money(check.sumFils) })
                : t("costs.invoice.check.differs", { sum: money(check.sumFils), total: money(totalFils ?? 0) })}
          </span>
        </p>
      </FormSection>

      {state === "failed" && error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-4 py-3 text-sm leading-relaxed text-ink"
        >
          <Icon name="alert" className="mt-0.5 h-4 w-4 text-danger" />
          {error}
        </div>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-page/90 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {invoice ? (
            <ActionButton
              variant="danger"
              icon="trash"
              label={t("costs.invoice.delete")}
              action={() => deleteInvoice(invoice.id)}
              redirectTo="/admin/costs/invoices?deleted=1"
              confirm={{
                title: t("costs.invoice.deleteTitle"),
                body: t("costs.invoice.deleteBody"),
                confirmLabel: t("costs.invoice.deleteConfirm"),
              }}
            />
          ) : null}
          <p
            aria-live="polite"
            className={cn(
              "order-first flex min-h-5 w-full items-center gap-2 text-sm sm:order-none sm:me-auto sm:w-auto",
              state === "failed" ? "text-danger" : "text-ink-3",
            )}
          >
            {state === "saving"
              ? t("common.saving")
              : state === "failed"
                ? t("common.couldNotSave")
                : !ready
                  ? t("costs.invoice.notReady")
                  : dirty
                    ? t("common.unsavedChanges")
                    : ""}
          </p>
          <ButtonLink href="/admin/costs/invoices" variant="ghost">
            {t("common.cancel")}
          </ButtonLink>
          <Button
            variant="primary"
            disabled={!ready}
            loading={state === "saving"}
            loadingText={t("common.saving")}
            onClick={save}
            className="max-sm:flex-1"
          >
            {isEdit ? t("costs.invoice.saveChanges") : t("costs.invoice.save")}
          </Button>
        </div>
      </div>

      <UnsavedChangesGuard active={dirty && state !== "saving"} />
    </div>
  );
}
