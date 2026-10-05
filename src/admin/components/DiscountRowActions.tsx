"use client";

import { useState } from "react";
import {
  deleteDiscount,
  getDiscountImpact,
  setDiscountActive,
} from "@backend/actions/discounts";
import { useI18n } from "@admin/i18n/client";
import { ConfirmDialog } from "@admin/ui/Dialog";
import { Dropdown, type DropdownItem } from "@admin/ui/Dropdown";
import { useAction } from "@admin/ui/useAction";
import { useActivationConfirm, withActivationConfirm } from "./DiscountConfirm";

/**
 * The "⋯" on a discount row: edit, duplicate, activate or deactivate, delete.
 *
 * ACTIVATE ASKS FIRST, whenever the discount would be live at once: the
 * server refuses the unconfirmed switch, works out what would change, and
 * the confirmation states it. A discount scheduled for later simply
 * activates — nothing changes today. Deactivating never asks: it makes the
 * discount a draft and no customer pays less because of it.
 *
 * Delete is behind its own confirmation, and is refused by the server (with
 * the number of orders) once any order has used the discount.
 */
export function DiscountRowActions({
  id,
  name,
  active,
  expired,
}: {
  id: number;
  name: string;
  active: boolean;
  /** An ended discount cannot be switched on; its dates are changed in the editor. */
  expired: boolean;
}) {
  const { t } = useI18n();
  const { state, run } = useAction();
  const { ask, dialog } = useActivationConfirm();
  const [deleting, setDeleting] = useState(false);
  const editHref = `/admin/discounts/${id}/edit`;

  const activate = () =>
    void run(() =>
      withActivationConfirm(
        (confirmed) => setDiscountActive(id, true, confirmed),
        () => getDiscountImpact(id),
        ask,
      ),
    );

  const items: DropdownItem[] = [
    { key: "edit", label: t("common.edit"), href: editHref, icon: "edit" },
    {
      key: "duplicate",
      label: t("discounts.duplicate"),
      href: `/admin/discounts/new?from=${id}`,
      icon: "plus",
    },
  ];
  if (active) {
    items.push({
      key: "deactivate",
      label: t("discounts.deactivate"),
      icon: "minus",
      onSelect: () => void run(() => setDiscountActive(id, false)),
    });
  } else if (!expired) {
    items.push({ key: "activate", label: t("discounts.activate"), icon: "check", onSelect: activate });
  }
  items.push({
    key: "delete",
    label: t("common.delete"),
    icon: "trash",
    tone: "danger",
    separatorBefore: true,
    onSelect: () => setDeleting(true),
  });

  return (
    <>
      <Dropdown label={t("common.moreActionsFor", { name })} items={items} />
      {dialog}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        pending={state === "saving"}
        title={t("discounts.form.deleteTitle", { name })}
        body={t("discounts.form.deleteBody")}
        confirmLabel={t("discounts.form.deleteConfirm")}
        onConfirm={() =>
          void run(() => deleteDiscount(id), {
            onSuccess: () => setDeleting(false),
            onFailure: () => setDeleting(false),
          })
        }
      />
    </>
  );
}
