"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import { fieldClasses } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";
import type { CostItemRow } from "@backend/domain/costs";
import { priceLineText } from "./cost-view";

/**
 * "Add from what you buy": a search box over What you buy that puts the
 * thing she picks into what goes into this arrangement.
 *
 * A combobox (the WAI-ARIA pattern): typing filters, the arrow keys move
 * through the list, Enter adds, Escape closes. It lives INSIDE the product's
 * form, so two things are held back on purpose — Enter never submits the
 * product, and typing a search is not an unsaved change to the product.
 *
 * When it is not in What you buy yet, the link to add it opens in a new
 * tab, so the product she is halfway through editing stays as it is.
 * `onOpenNew` lets the Cost section read the list again when she comes back,
 * so the new thing is in this list without reloading the page.
 */

const MAX_SHOWN = 50;

/** Every word she typed appears in the name or a name printed on one of her invoices. */
function matches(item: CostItemRow, words: string[]): boolean {
  if (words.length === 0) return true;
  const haystack = [item.name, ...item.aliases].join(" ").toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function ProductCostPicker({
  items,
  inRecipe,
  onAdd,
  onOpenNew,
}: {
  /** What she still buys. */
  items: CostItemRow[];
  inRecipe: ReadonlySet<number>;
  onAdd: (item: CostItemRow) => void;
  onOpenNew: () => void;
}) {
  const i18n = useI18n();
  const { t, plural } = i18n;
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const words = useMemo(
    () =>
      query
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    [query],
  );
  const shown = useMemo(() => items.filter((item) => matches(item, words)).slice(0, MAX_SHOWN), [items, words]);
  const choosable = shown.filter((item) => !inRecipe.has(item.id));
  const activeItem = choosable[Math.min(active, choosable.length - 1)];
  const expanded = open && shown.length > 0;
  const trimmed = query.trim();
  const newHref = `/admin/costs/buy/new${trimmed ? `?name=${encodeURIComponent(trimmed)}` : ""}`;

  /* The search is not part of the product: stop its keystrokes reaching the
     form's "unsaved changes" listener. */
  const keepFromForm = (event: SyntheticEvent) => event.stopPropagation();

  function add(item: CostItemRow) {
    onAdd(item);
    setQuery("");
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      /* Never the product's Save. */
      event.preventDefault();
      if (expanded && activeItem) add(activeItem);
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      } else if (query) {
        event.preventDefault();
        setQuery("");
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (choosable.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (Math.min(current, choosable.length - 1) + delta + choosable.length) % choosable.length);
    }
  }

  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
        {t("costs.product.picker.label")}
      </label>
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <Icon
          name="search"
          className="pointer-events-none absolute start-3 top-[1.375rem] h-4 w-4 -translate-y-1/2 text-ink-3"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeItem ? `${baseId}-option-${activeItem.id}` : undefined}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={t("costs.product.picker.placeholder")}
          value={query}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            keepFromForm(event);
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onInput={keepFromForm}
          onKeyDown={onKeyDown}
          className={cn(fieldClasses, "ps-9")}
        />

        {/* Kept in the page even when closed, so aria-controls always points
            at something; hidden from everyone until it has rows to show. */}
        <ul
          id={listId}
          role="listbox"
          aria-label={t("costs.product.picker.label")}
          hidden={!expanded}
          className="mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-md border border-line bg-raised p-1 shadow-card"
        >
          {shown.map((item) => {
            const taken = inRecipe.has(item.id);
            const isActive = !taken && activeItem?.id === item.id;
            return (
              <li
                key={item.id}
                id={`${baseId}-option-${item.id}`}
                role="option"
                aria-selected={isActive}
                aria-disabled={taken || undefined}
                /* Keep focus in the search box, so the list does not close
                   before the click lands (Safari does not focus buttons). */
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => (taken ? undefined : add(item))}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-sm",
                  taken ? "cursor-default text-ink-3" : "cursor-pointer text-ink hover:bg-hover",
                  isActive && "bg-hover",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span
                    className={cn(
                      "block text-xs tabular",
                      item.priceForOneFils === null ? "text-warning" : "text-ink-3",
                    )}
                  >
                    {priceLineText(i18n, item)}
                  </span>
                </span>
                {taken ? (
                  <span className="shrink-0 text-xs text-ink-3">{t("costs.product.picker.inRecipe")}</span>
                ) : (
                  <Icon name="plus" className="h-4 w-4 shrink-0 text-ink-3" />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <p aria-live="polite" className="sr-only">
        {open && words.length > 0 ? plural("costs.product.picker.results", shown.length) : ""}
      </p>

      {words.length > 0 && shown.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{t("costs.product.picker.noMatch", { query: trimmed })}</p>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        <a
          href={newHref}
          target="_blank"
          rel="noreferrer"
          onClick={onOpenNew}
          className="-my-3 inline-flex items-center gap-1 py-3 font-medium text-ink underline underline-offset-4 hover:text-accent"
        >
          {t("costs.product.picker.addNew")}
          <Icon name="external" className="h-3.5 w-3.5" />
        </a>{" "}
        {t("costs.product.picker.newTabHint")}
      </p>
    </div>
  );
}
