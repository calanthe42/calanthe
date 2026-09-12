"use client";

import { updateOrderFulfilment, updateOrderOperations } from "@backend/actions/admin";
import { useI18n } from "@admin/i18n/client";
import type { MessageKey } from "@admin/i18n/translate";
import { ActionButton } from "@admin/ui/ActionButton";
import { ActionForm } from "@admin/ui/ActionForm";
import { Card, CardHeader } from "@admin/ui/Card";
import { Field, Select, Textarea } from "@admin/ui/Field";
import type { IconName } from "@admin/ui/icons";

/**
 * The operational half of an order: where the flowers are, who is making
 * them, what the florist needs to remember.
 *
 * There is deliberately no payment control here. Money state moves through a
 * payment provider's webhook and nowhere else, so a "Mark as paid" button
 * would be a lie the interface tells about what it can do — and a hole in the
 * one rule the order model exists to protect.
 *
 * Only the legal next steps are offered. The server re-validates regardless;
 * this just avoids presenting a move that will be refused.
 */

const FLOW: Record<string, string[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const NEXT: Record<string, { label: MessageKey; icon: IconName }> = {
  CONFIRMED: { label: "orders.ops.next.CONFIRMED", icon: "check" },
  PREPARING: { label: "orders.ops.next.PREPARING", icon: "flower" },
  READY: { label: "orders.ops.next.READY", icon: "box" },
  OUT_FOR_DELIVERY: { label: "orders.ops.next.OUT_FOR_DELIVERY", icon: "truck" },
  DELIVERED: { label: "orders.ops.next.DELIVERED", icon: "checkCircle" },
  CANCELLED: { label: "orders.ops.next.CANCELLED", icon: "close" },
};

export function OrderOps({
  orderId,
  fulfilmentStatus,
  internalNotes,
  assignedStaffId,
  staff,
}: {
  orderId: number;
  fulfilmentStatus: string;
  internalNotes?: string;
  assignedStaffId?: number;
  staff: { label: string; value: string }[];
}) {
  const { t } = useI18n();
  const next = FLOW[fulfilmentStatus] ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t("orders.ops.title")} description={t("orders.ops.paymentUnaffected")} />
        {next.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">
            {fulfilmentStatus === "DELIVERED" ? t("orders.ops.delivered") : t("orders.ops.cancelled")}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {next.map((status) => {
              const step = NEXT[status];
              return (
                <ActionButton
                  key={status}
                  action={() => updateOrderFulfilment(orderId, status)}
                  label={step ? t(step.label) : status}
                  icon={step?.icon}
                  variant={status === "CANCELLED" ? "danger" : "primary"}
                  confirm={
                    status === "CANCELLED"
                      ? {
                          title: t("orders.ops.cancelTitle"),
                          body: t("orders.ops.cancelBody"),
                          confirmLabel: t("orders.ops.next.CANCELLED"),
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </Card>

      <section aria-labelledby="order-notes-title">
        <h2 id="order-notes-title" className="mb-2 text-[15px] font-semibold text-ink">
          {t("orders.ops.notesTitle")}
        </h2>
        <ActionForm variant="card" action={(form) => updateOrderOperations(orderId, form)} submitLabel={t("orders.ops.saveNotes")}>
          <Card>
            <div className="grid gap-5">
              <p className="text-xs leading-relaxed text-ink-3">{t("orders.ops.notesHint")}</p>
              <Field id="assignedStaff" label={t("orders.ops.assigned")}>
                <Select
                  id="assignedStaff"
                  name="assignedStaff"
                  options={staff}
                  defaultValue={assignedStaffId ? String(assignedStaffId) : ""}
                  placeholder={t("orders.ops.nobody")}
                />
              </Field>
              <Field id="internalNotes" label={t("orders.ops.notes")}>
                <Textarea id="internalNotes" name="internalNotes" rows={5} defaultValue={internalNotes} />
              </Field>
            </div>
          </Card>
        </ActionForm>
      </section>
    </div>
  );
}
