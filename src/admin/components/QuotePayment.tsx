"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import {
  cancelPaymentRequest,
  confirmEnquiryQuote,
  resendPaymentRequest,
} from "@backend/actions/quotes";
import type { QuotePrefill } from "@backend/domain/quote";
import type { PayRequestState } from "@backend/payments/pay-link";
import { useI18n } from "@admin/i18n/client";
import { toneFor } from "@admin/lib/status";
import { ActionButton } from "@admin/ui/ActionButton";
import { Badge } from "@admin/ui/Badge";
import { Button, ButtonLink } from "@admin/ui/Button";
import { Card, CardHeader } from "@admin/ui/Card";
import { DescriptionList } from "@admin/ui/Content";
import { Dialog } from "@admin/ui/Dialog";
import { Field, Input, PrefixInput, Select, Textarea } from "@admin/ui/Field";
import { Icon } from "@admin/ui/icons";
import { Notice } from "@admin/ui/States";
import { useToast } from "@admin/ui/Toast";
import { useAction } from "@admin/ui/useAction";

/**
 * The payment request on an enquiry — and, in its compact form, on the order
 * it created.
 *
 * One card, five states, all read from the ORDER (never from the enquiry's
 * own status, which staff can set by hand):
 *
 *   none / cancelled   "Confirm & request payment" opens the form
 *   awaiting           what was sent, resend, copy the link, cancel
 *   expired            the same, with "send a new link"
 *   paid               the invoice number and the order
 *
 * NOTHING HERE TAKES MONEY OR MARKS ANYTHING PAID. Confirming creates an
 * unpaid order and emails a link; the customer pays on the storefront and
 * only Stripe's signed webhook marks the order paid. The amount typed here is
 * parsed and bounded again on the server (backend/domain/quote.ts) — the
 * "AED 650" this form shows while typing is a preview, not the charge.
 *
 * The page renders this ABOVE its two columns, so on a phone — where the
 * florist works — the action is at the top, not under the whole enquiry.
 */

/** The request, as plain data. Never the salt, the hash or an intent id. */
export type QuoteCardData = {
  orderId: number;
  orderNumber: string;
  state: PayRequestState;
  totalFils: number;
  customerEmail: string;
  createdAt: string;
  payLinkExpiresAt: string | null;
  paidAt: string | null;
  invoiceNumber: string | null;
  payUrl: string | null;
  /** A ready wa.me link carrying the pay link, when the phone allows one. */
  whatsappHref: string | null;
  lastEmail: { status: string; createdAt: string } | null;
  sendCount: number;
};

/** What the confirm form needs. Absent when the enquiry cannot be quoted. */
export type QuoteFormSetup = {
  enquiryId: number;
  customerName: string;
  prefill: QuotePrefill;
  slots: readonly string[];
  /** YYYY-MM-DD in the UAE: the earliest delivery day the server accepts. */
  todayDubai: string;
  ttlDays: number;
};

/** A typed amount as fils, for the PREVIEW only. The server parses for real. */
function previewFils(raw: string): number | null {
  const cleaned = raw.trim().replace(/^aed\s*/i, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const fils = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(fils) && fils > 0 ? fils : null;
}

export function QuotePayment({
  quote,
  form,
  variant = "card",
}: {
  quote: QuoteCardData | null;
  form: QuoteFormSetup | null;
  /** "notice": the compact strip on an order page — actions only, no facts. */
  variant?: "card" | "notice";
}) {
  const { t, plural, label, money, date } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const state = quote?.state ?? null;
  const live = state === "awaiting" || state === "expired";
  const canConfirm = Boolean(form) && (state === null || state === "cancelled");

  async function copyLink() {
    if (!quote?.payUrl) return;
    try {
      await navigator.clipboard.writeText(quote.payUrl);
      toast.success(t("enquiries.quote.copied"));
    } catch {
      toast.error(t("enquiries.quote.copyFailed"));
    }
  }

  const liveActions =
    quote && live ? (
      <div className="flex flex-wrap gap-2">
        <ActionButton
          action={() => resendPaymentRequest(quote.orderId)}
          label={state === "expired" ? t("enquiries.quote.newLink") : t("enquiries.quote.resend")}
          icon="mail"
          variant={state === "expired" ? "primary" : "secondary"}
          className="max-sm:flex-1"
        />
        {quote.payUrl ? (
          <Button icon="external" onClick={() => void copyLink()} className="max-sm:flex-1">
            {t("enquiries.quote.copy")}
          </Button>
        ) : null}
        {quote.whatsappHref && state === "awaiting" ? (
          <ButtonLink href={quote.whatsappHref} external icon="message" className="max-sm:flex-1">
            {t("enquiries.quote.whatsapp")}
          </ButtonLink>
        ) : null}
        <ActionButton
          action={() => cancelPaymentRequest(quote.orderId)}
          label={t("enquiries.quote.cancel")}
          variant="danger"
          className="max-sm:flex-1"
          confirm={{
            title: t("enquiries.quote.cancelTitle"),
            body: t("enquiries.quote.cancelBody"),
            confirmLabel: t("enquiries.quote.cancel"),
          }}
        />
      </div>
    ) : null;

  if (variant === "notice") return liveActions;

  /* An enquiry that cannot be quoted and never was: nothing to show. */
  if (!quote && !form) return null;

  const orderHref = quote ? `/admin/orders/${encodeURIComponent(quote.orderNumber)}` : "";
  const orderLink = quote ? (
    <Link href={orderHref} className="font-medium text-ink underline underline-offset-4">
      {quote.orderNumber}
    </Link>
  ) : null;
  const emailFailed = Boolean(quote && live && quote.lastEmail && quote.lastEmail.status !== "sent");

  return (
    <Card as="section" className="mb-6">
      <CardHeader
        title={t("enquiries.quote.title")}
        action={
          state ? (
            <Badge tone={toneFor("payRequest", state)} dot>
              {label("payRequest", state)}
            </Badge>
          ) : null
        }
      />

      {quote && live ? (
        <>
          {emailFailed ? (
            <Notice tone="warning" className="mb-0 mt-3">
              {t("enquiries.quote.emailNotSent", {
                status: label("emailStatus", quote.lastEmail?.status),
              })}
            </Notice>
          ) : null}
          <div className="mt-3">
            <DescriptionList
              emptyLabel={t("common.nothingProvided")}
              rows={[
                [t("enquiries.quote.amountRow"), <span key="a" className="font-semibold tabular">{money(quote.totalFils)}</span>],
                [t("enquiries.quote.order"), orderLink],
                [t("enquiries.quote.sentTo"), <span key="e" dir="ltr">{quote.customerEmail}</span>],
                [
                  t("enquiries.quote.lastSent"),
                  quote.lastEmail
                    ? `${date(quote.lastEmail.createdAt, "datetime")} · ${plural("enquiries.quote.sentCount", quote.sendCount)}`
                    : null,
                ],
                [
                  state === "expired" ? t("enquiries.quote.expired") : t("enquiries.quote.expires"),
                  quote.payLinkExpiresAt ? date(quote.payLinkExpiresAt, "datetime") : null,
                ],
              ]}
            />
          </div>
          <div className="mt-4">{liveActions}</div>
        </>
      ) : null}

      {quote && state === "paid" ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{t("enquiries.quote.paidIntro")}</p>
          <div className="mt-3">
            <DescriptionList
              emptyLabel={t("common.nothingProvided")}
              rows={[
                [t("enquiries.quote.amountRow"), <span key="a" className="font-semibold tabular">{money(quote.totalFils)}</span>],
                [t("enquiries.quote.paidOn"), quote.paidAt ? date(quote.paidAt, "datetime") : null],
                [t("enquiries.quote.invoice"), quote.invoiceNumber ? <span key="i" dir="ltr">{quote.invoiceNumber}</span> : null],
                [t("enquiries.quote.order"), orderLink],
              ]}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={orderHref} variant="primary" iconEnd="chevronRight" className="max-sm:flex-1">
              {t("enquiries.quote.openOrder")}
            </ButtonLink>
            {quote.payUrl ? (
              <ButtonLink href={quote.payUrl} external icon="external" className="max-sm:flex-1">
                {t("enquiries.quote.viewInvoice")}
              </ButtonLink>
            ) : null}
          </div>
        </>
      ) : null}

      {canConfirm && form ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {state === "cancelled" ? t("enquiries.quote.cancelledIntro") : t("enquiries.quote.intro")}
          </p>
          {quote && state === "cancelled" ? (
            <p className="mt-1 text-xs text-ink-3">
              {orderLink} · <span className="tabular">{money(quote.totalFils)}</span> ·{" "}
              {date(quote.createdAt, "short")}
            </p>
          ) : null}
          <div className="mt-4">
            <Button variant="primary" icon="mail" onClick={() => setOpen(true)} className="max-sm:w-full">
              {state === "cancelled" ? t("enquiries.quote.again") : t("enquiries.quote.open")}
            </Button>
          </div>
          <ConfirmQuoteDialog open={open} onClose={() => setOpen(false)} setup={form} />
        </>
      ) : null}

      {/* Cancelled, on an enquiry that can no longer be quoted (marked spam). */}
      {quote && state === "cancelled" && !canConfirm ? (
        <p className="mt-2 text-sm text-ink-2">
          {orderLink} · <span className="tabular">{money(quote.totalFils)}</span>
        </p>
      ) : null}
    </Card>
  );
}

/**
 * The form. One sheet on a phone, ordered for the common case: the amount
 * first and focused, then who it goes to, then delivery, then the rest.
 * Everything typed survives a refusal — the dialog stays open and says why.
 */
function ConfirmQuoteDialog({
  open,
  onClose,
  setup,
}: {
  open: boolean;
  onClose: () => void;
  setup: QuoteFormSetup;
}) {
  const { t, money } = useI18n();
  const { run, pending, error, reset } = useAction();
  const formId = useId();
  const { prefill } = setup;

  const [amount, setAmount] = useState(prefill.amountAed);
  const [email, setEmail] = useState(prefill.customerEmail);

  const fils = previewFils(amount);
  const amountText = fils ? money(fils) : null;
  const hasGift = Boolean(prefill.recipientName || prefill.recipientPhone || prefill.cardMessage);

  function close() {
    if (pending) return;
    reset();
    onClose();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    void run(() => confirmEnquiryQuote(setup.enquiryId, data), {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("enquiries.quote.dialogTitle")}
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
            {amountText
              ? t("enquiries.quote.submit", { amount: amountText })
              : t("enquiries.quote.submitPlain")}
          </Button>
        </>
      }
    >
      {/* method="post": before hydration a form with no method is a GET, and
          this one carries a customer's address and phone. */}
      <form id={formId} method="post" noValidate onSubmit={onSubmit} className="grid gap-5">
        <Field
          id="quote-amount"
          label={t("enquiries.quote.amount")}
          required
          hint={
            <>
              {prefill.indicativeFils
                ? `${t("enquiries.quote.amountHint", { amount: money(prefill.indicativeFils) })} `
                : null}
              {t("enquiries.quote.amountFixed")}
            </>
          }
        >
          <PrefixInput
            id="quote-amount"
            name="amountAed"
            prefix="AED"
            withHint
            data-autofocus
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular"
            dir="ltr"
          />
        </Field>

        <Field id="quote-email" label={t("enquiries.quote.sendTo")} required hint={t("enquiries.quote.sendToHint")}>
          <Input
            id="quote-email"
            name="customerEmail"
            type="email"
            withHint
            dir="ltr"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field id="quote-phone" label={t("enquiries.quote.phone")} required>
          <Input
            id="quote-phone"
            name="customerPhone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            placeholder="+971501234567"
            defaultValue={prefill.customerPhone}
          />
        </Field>

        <fieldset className="m-0 grid min-w-0 gap-5 border-0 border-t border-line p-0 pt-5">
          <legend className="sr-only">{t("enquiries.quote.deliverySection")}</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="quote-date" label={t("enquiries.quote.deliveryDate")} required>
              <Input
                id="quote-date"
                name="deliveryDate"
                type="date"
                min={setup.todayDubai}
                defaultValue={prefill.deliveryDate}
              />
            </Field>
            <Field id="quote-slot" label={t("enquiries.quote.timeSlot")} required>
              <Select
                id="quote-slot"
                name="deliveryTimeSlot"
                dir="ltr"
                defaultValue={prefill.deliveryTimeSlot}
                placeholder={t("enquiries.quote.chooseSlot")}
                options={setup.slots.map((slot) => ({ value: slot, label: slot }))}
              />
            </Field>
          </div>
          <Field id="quote-address" label={t("enquiries.quote.address")} required hint={t("enquiries.quote.emirate")}>
            <Textarea
              id="quote-address"
              name="deliveryAddress"
              withHint
              rows={2}
              maxLength={600}
              defaultValue={prefill.deliveryAddress}
            />
          </Field>
        </fieldset>

        <Field id="quote-description" label={t("enquiries.quote.description")}>
          <Input id="quote-description" name="description" maxLength={140} defaultValue={prefill.description} />
        </Field>

        <details open={hasGift} className="rounded-md border border-line">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-medium text-ink">
            <Icon name="gift" className="h-4 w-4 text-ink-3" />
            {t("enquiries.quote.gift")}
          </summary>
          <div className="grid gap-5 border-t border-line p-3">
            <Field id="quote-recipient" label={t("enquiries.quote.recipientName")}>
              <Input id="quote-recipient" name="recipientName" maxLength={140} defaultValue={prefill.recipientName} />
            </Field>
            <Field id="quote-recipient-phone" label={t("enquiries.quote.recipientPhone")}>
              <Input
                id="quote-recipient-phone"
                name="recipientPhone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                placeholder="+971501234567"
                defaultValue={prefill.recipientPhone}
              />
            </Field>
            <Field id="quote-card" label={t("enquiries.quote.cardMessage")}>
              <Textarea id="quote-card" name="cardMessage" rows={2} maxLength={300} defaultValue={prefill.cardMessage} />
            </Field>
          </div>
        </details>

        <Field id="quote-note" label={t("enquiries.quote.note")} hint={t("enquiries.quote.noteHint")}>
          <Textarea id="quote-note" name="customerNote" withHint rows={3} maxLength={600} defaultValue={prefill.customerNote} />
        </Field>

        <Field id="quote-locale" label={t("enquiries.quote.language")}>
          <Select
            id="quote-locale"
            name="locale"
            defaultValue={prefill.locale}
            options={[
              { value: "en", label: t("language.en") },
              { value: "ar", label: t("language.ar") },
            ]}
          />
        </Field>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-4 py-3 text-sm leading-relaxed text-ink"
          >
            <Icon name="alert" className="mt-0.5 h-4 w-4 text-danger" />
            {error}
          </div>
        ) : null}

        <p aria-live="polite" className="rounded-md bg-sunken px-4 py-3 text-sm leading-relaxed text-ink-2">
          {amountText
            ? t("enquiries.quote.summary", {
                name: setup.customerName,
                email: email.trim() || "—",
                amount: amountText,
                days: setup.ttlDays,
              })
            : t("enquiries.quote.summaryNoAmount")}
        </p>
      </form>
    </Dialog>
  );
}
