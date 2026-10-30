"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@admin/i18n/client";
import { ActionForm, useMarkDirty } from "@admin/ui/ActionForm";
import { Badge } from "@admin/ui/Badge";
import { Button } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { ConfirmDialog } from "@admin/ui/Dialog";
import { Field, Input, PrefixInput, Switch } from "@admin/ui/Field";
import { IconButton } from "@admin/ui/IconButton";
import { saveAddons } from "@backend/actions/addons";
import { ADDON_LIMITS, type StoreAddon } from "@/lib/store-settings";

/**
 * The owner's add-ons, one row each: the name in English and in Arabic, the
 * price, "Show on products", up, down and remove — then one Save for the
 * whole list, in the order she leaves it.
 *
 * Nothing here is saved until Save. Removing asks first and says that past
 * orders keep the add-on as it was sold. Each row carries the key the server
 * gave it, sent back untouched; a new row has none, and the server makes one
 * from its English name (backend/domain/addon-form.ts). The action re-checks
 * every rule, so the limits here only spare her a refused save.
 *
 * After a save the page is refreshed with a new `version`, and the rows start
 * again from what was saved — which is how a new row learns its key.
 */

type Row = {
  /** Stable for React and the field ids; never sent. */
  uid: string;
  key?: string;
  nameEn: string;
  nameAr: string;
  priceAed: string;
  active: boolean;
};

/** 15000 → "150", 1250 → "12.50", 0 → "0". */
const priceText = (fils: number) => (fils / 100).toFixed(fils % 100 === 0 ? 0 : 2);

const rowOf = (addon: StoreAddon): Row => ({
  uid: addon.key,
  key: addon.key,
  nameEn: addon.nameEn,
  nameAr: addon.nameAr,
  priceAed: priceText(addon.priceFils),
  active: addon.active,
});

export function AddonsForm({ addons, version }: { addons: readonly StoreAddon[]; version: string }) {
  return (
    <ActionForm action={saveAddons}>
      <AddonRows key={version} initial={addons} />
    </ActionForm>
  );
}

function AddonRows({ initial }: { initial: readonly StoreAddon[] }) {
  const { t, locale } = useI18n();
  const markDirty = useMarkDirty();
  const [rows, setRows] = useState<Row[]>(() => initial.map(rowOf));
  const [removing, setRemoving] = useState<Row | null>(null);
  /* The element to focus once the list has re-rendered. */
  const [focusId, setFocusId] = useState<string | null>(null);
  const nextNew = useRef(0);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  const full = rows.length >= ADDON_LIMITS.maxCount;
  const nameOf = (row: Row) =>
    (locale === "ar" ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || t("addons.thisOne");

  function change(uid: string, patch: Partial<Row>) {
    setRows((list) => list.map((row) => (row.uid === uid ? { ...row, ...patch } : row)));
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    const row = rows[index];
    if (!row || to < 0 || to >= rows.length) return;
    const next = [...rows];
    next.splice(index, 1);
    next.splice(to, 0, row);
    setRows(next);
    markDirty();
    /* At the top its "up" is switched off, at the bottom its "down": the
       focus moves to the one that still works, rather than being lost. */
    if (to === 0) setFocusId(`addon-${row.uid}-down`);
    else if (to === next.length - 1) setFocusId(`addon-${row.uid}-up`);
  }

  function add() {
    if (full) return;
    nextNew.current += 1;
    const uid = `new-${nextNew.current}`;
    setRows((list) => [...list, { uid, nameEn: "", nameAr: "", priceAed: "", active: true }]);
    markDirty();
    setFocusId(`addon-${uid}-en`);
  }

  function confirmRemove() {
    if (!removing) return;
    setRows((list) => list.filter((row) => row.uid !== removing.uid));
    setRemoving(null);
    markDirty();
    setFocusId("addons-add");
  }

  const sent = JSON.stringify(rows.map(({ key, nameEn, nameAr, priceAed, active }) => ({ key, nameEn, nameAr, priceAed, active })));

  return (
    <div className="max-w-3xl">
      <input type="hidden" name="addons" value={sent} />
      <FormSection id="addons-list" title={t("addons.listTitle")} description={t("addons.listHint")}>
        <ol className="grid gap-4">
          {rows.map((row, index) => {
            const id = `addon-${row.uid}`;
            const name = nameOf(row);
            return (
              <li key={row.uid} aria-labelledby={`${id}-title`} className="min-w-0 rounded-md border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-sunken/60 py-1 pe-1 ps-4">
                  <h3 id={`${id}-title`} className="text-sm font-semibold text-ink">
                    {t("addons.row", { n: index + 1 })}
                  </h3>
                  {row.active ? null : <Badge>{t("addons.hidden")}</Badge>}
                  <div className="ms-auto flex items-center">
                    <IconButton
                      id={`${id}-up`}
                      icon="arrowUp"
                      label={t("addons.moveUp", { name })}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <IconButton
                      id={`${id}-down`}
                      icon="arrowDown"
                      label={t("addons.moveDown", { name })}
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                    />
                    <IconButton
                      icon="trash"
                      label={t("addons.remove", { name })}
                      className="text-danger hover:text-danger"
                      onClick={() => setRemoving(row)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <Field id={`${id}-en`} label={t("addons.nameEn")} required>
                    <Input
                      id={`${id}-en`}
                      lang="en"
                      dir="ltr"
                      autoComplete="off"
                      maxLength={ADDON_LIMITS.nameMax}
                      required
                      placeholder={t("addons.nameEnPlaceholder")}
                      value={row.nameEn}
                      onChange={(event) => change(row.uid, { nameEn: event.target.value })}
                    />
                  </Field>
                  <Field id={`${id}-ar`} label={t("addons.nameAr")} required>
                    <Input
                      id={`${id}-ar`}
                      lang="ar"
                      dir="rtl"
                      autoComplete="off"
                      maxLength={ADDON_LIMITS.nameMax}
                      required
                      placeholder={t("addons.nameArPlaceholder")}
                      value={row.nameAr}
                      onChange={(event) => change(row.uid, { nameAr: event.target.value })}
                    />
                  </Field>
                  <Field id={`${id}-price`} label={t("addons.price")} hint={t("addons.priceHint")} required>
                    <PrefixInput
                      id={`${id}-price`}
                      prefix="AED"
                      withHint
                      inputMode="decimal"
                      autoComplete="off"
                      required
                      value={row.priceAed}
                      onChange={(event) => change(row.uid, { priceAed: event.target.value })}
                      className="tabular"
                    />
                  </Field>
                  <Switch
                    label={t("addons.show")}
                    hint={t("addons.showHint")}
                    checked={row.active}
                    onChange={(event) => change(row.uid, { active: event.target.checked })}
                    className="self-end"
                  />
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <Button id="addons-add" icon="plus" onClick={add} disabled={full} className="max-sm:w-full">
            {t("addons.add")}
          </Button>
          {full ? (
            <p className="text-sm text-ink-3">{t("addons.full", { max: ADDON_LIMITS.maxCount })}</p>
          ) : null}
        </div>
      </FormSection>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={t("addons.removeTitle", { name: removing ? nameOf(removing) : "" })}
        body={t("addons.removeBody")}
        confirmLabel={t("addons.removeConfirm")}
        cancelLabel={t("addons.keep")}
      />
    </div>
  );
}
