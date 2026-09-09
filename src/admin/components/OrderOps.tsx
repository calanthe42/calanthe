"use client";

import { updateOrderFulfilment, updateOrderOperations } from "@backend/actions/admin";
import { ActionButton, ActionForm, Field, Fieldset, Select, TextArea } from "@admin/components/Form";

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

const LABEL: Record<string, string> = {
  CONFIRMED: "Confirm order",
  PREPARING: "Start preparing",
  READY: "Mark ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel order",
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
  const next = FLOW[fulfilmentStatus] ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 font-display text-xl font-light text-olive">Move this order on</h2>
        <div className="rounded-md border border-hairline/70 bg-white p-5">
          {next.length === 0 ? (
            <p className="text-sm text-sage">
              This order is {fulfilmentStatus === "DELIVERED" ? "delivered" : "cancelled"}. There
              is nothing further to do.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {next.map((status) => (
                <ActionButton
                  key={status}
                  action={() => updateOrderFulfilment(orderId, status)}
                  label={LABEL[status] ?? status}
                  variant={status === "CANCELLED" ? "danger" : "primary"}
                  confirm={
                    status === "CANCELLED"
                      ? "Cancelling keeps the order and its record — it is never deleted. This cannot be undone from here."
                      : undefined
                  }
                />
              ))}
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-sage">
            Payment is recorded separately and is not changed by any of these steps.
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl font-light text-olive">Workshop notes</h2>
        <ActionForm
          action={(form) => updateOrderOperations(orderId, form)}
          submitLabel="Save notes"
        >
          <Fieldset legend="Internal" hint="Never shown to the customer and never emailed.">
            <Field label="Assigned to" name="assignedStaff">
              <Select
                name="assignedStaff"
                options={staff}
                defaultValue={assignedStaffId ? String(assignedStaffId) : ""}
                placeholder="Nobody yet"
              />
            </Field>
            <Field label="Notes" name="internalNotes">
              <TextArea name="internalNotes" rows={5} defaultValue={internalNotes} />
            </Field>
          </Fieldset>
        </ActionForm>
      </div>
    </div>
  );
}
