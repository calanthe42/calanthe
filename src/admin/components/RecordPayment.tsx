"use client";

import { useId, useState, type FormEvent } from "react";
import { recordOutsidePayment } from "@backend/actions/manual-orders";
import { useI18n } from "@admin/i18n/client";
import { Button } from "@admin/ui/Button";
import { Dialog } from "@admin/ui/Dialog";
import { Field, Input, Select } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";
import { useAction } from "@admin/ui/useAction";

/**
 * "Record payment" — the owner's one way to say an order written by hand was
 * paid outside the website: cash, bank transfer or the card machine.
 *
 * It is a sheet with a sentence that says what will happen, because it
 * cannot be undone: the order becomes paid and its invoice number is issued.
 * The page only renders this for the owner; the server refuses anyone else.
 */
const METHODS = ["cash", "bank-transfer", "card-machine"] as const;

export function RecordPayment({ orderId, totalFils }: { orderId: number; totalFils: number }) {
  const { t, label, money } = useI18n();
  const { run, pending, error, reset } = useAction();
  const [open, setOpen] = useState(false);
  const formId = useId();

  function close() {
    if (pending) return;
    reset();
    setOpen(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    void run(() => recordOutsidePayment(orderId, data), {
      onSuccess: () => {
        reset();
        setOpen(false);
      },
    });
  }

  return (
    <>
      <Button variant="primary" icon="check" onClick={() => setOpen(true)} className="max-sm:flex-1">
        {t("orders.detail.recordPayment")}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={t("orders.detail.recordTitle")}
        description={t("orders.detail.recordBody")}
        variant="sheet"
        dismissible={!pending}
        footer={
          <>
            <Button onClick={close} disabled={pending} className="max-sm:flex-1">
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              loading={pending}
              loadingText={t("common.working")}
              className="max-sm:flex-1"
            >
              {t("orders.detail.recordSubmit", { amount: money(totalFils) })}
            </Button>
          </>
        }
      >
        <form id={formId} method="post" noValidate onSubmit={onSubmit} className="grid gap-5">
          <Field id="rp-method" label={t("orders.detail.recordMethod")} required>
            <Select
              id="rp-method"
              name="method"
              defaultValue="cash"
              options={METHODS.map((value) => ({ value, label: label("paymentMethod", value) }))}
            />
          </Field>
          <Field id="rp-reference" label={t("orders.new.reference")}>
            <Input
              id="rp-reference"
              name="reference"
              maxLength={140}
              placeholder={t("orders.new.referencePlaceholder")}
            />
          </Field>
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-4 py-3 text-sm leading-relaxed text-ink"
            >
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              {error}
            </div>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
