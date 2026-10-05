"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { createManualOrder } from "@backend/actions/manual-orders";
import { useI18n } from "@admin/i18n/client";
import { Button, ButtonLink } from "@admin/ui/Button";
import { Card, CardHeader } from "@admin/ui/Card";
import { Checkbox, Field, Input, PrefixInput, Select, Textarea } from "@admin/ui/Field";
import { IconButton } from "@admin/ui/IconButton";
import { Icon } from "@admin/ui/icons";
import { Notice } from "@admin/ui/States";
import { useAction } from "@admin/ui/useAction";

/**
 * Writing an order by hand — a sale that arrived on WhatsApp, by phone or in
 * person — so it lives in the same order history as every website order and
 * gets its invoice from the same numbered series.
 *
 * Built for a phone held in one hand: one column, the customer first, then
 * what was sold, then where it goes, then how it is paid. Every price shown
 * while typing is a PREVIEW; the server parses and adds everything up again
 * (backend/domain/manual-order.ts) and the saved order is what counts.
 *
 * Staff can save an unpaid order and share its payment link. Recording a
 * payment taken outside the website is the owner's alone — the three "paid"
 * choices are disabled for anyone else, and refused by the server regardless.
 */

export type ManualProductOption = { id: number; name: string; priceAed: string };

type Line = {
  key: number;
  productId: number | null;
  description: string;
  detail: string;
  unitAed: string;
  quantity: string;
};

type Payment = "unpaid" | "cash" | "bank-transfer" | "card-machine";
const CHANNELS = ["whatsapp", "phone", "instagram", "website", "in-person", "other"] as const;

/** A typed amount as fils, for the PREVIEW only. The server parses for real. */
function previewFils(raw: string): number {
  const cleaned = raw.trim().replace(/^aed\s*/i, "").replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return 0;
  const fils = Math.round(Number(cleaned) * 100);
  return Number.isSafeInteger(fils) && fils > 0 ? fils : 0;
}

export function ManualOrderForm({
  products,
  slots,
  todayDubai,
  isOwner,
  paymentsReady,
  defaultLocale,
}: {
  products: readonly ManualProductOption[];
  slots: readonly string[];
  /** YYYY-MM-DD in the UAE: the date field starts here. */
  todayDubai: string;
  isOwner: boolean;
  /** Card payments are set up, so a pay button can be emailed. */
  paymentsReady: boolean;
  defaultLocale: "en" | "ar";
}) {
  const { t, label, money } = useI18n();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const formId = useId();
  const nextKey = useRef(1);

  const [lines, setLines] = useState<Line[]>([]);
  const [email, setEmail] = useState("");
  const [pickup, setPickup] = useState(false);
  const [payment, setPayment] = useState<Payment>("unpaid");

  const totalFils = lines.reduce(
    (sum, line) => sum + previewFils(line.unitAed) * (Number.parseInt(line.quantity, 10) || 0),
    0,
  );
  const hasEmail = email.trim() !== "";

  function addLine(product: ManualProductOption | null) {
    setLines((current) => [
      ...current,
      {
        key: nextKey.current++,
        productId: product?.id ?? null,
        description: "",
        detail: "",
        unitAed: product?.priceAed ?? "",
        quantity: "1",
      },
    ]);
  }

  function patchLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function chooseProduct(key: number, value: string) {
    const product = products.find((p) => String(p.id) === value) ?? null;
    patchLine(key, {
      productId: product?.id ?? null,
      /* Changing the product resets the price to that product's own. */
      ...(product ? { unitAed: product.priceAed } : {}),
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    data.set(
      "lines",
      JSON.stringify(
        lines.map((line) => ({
          ...(line.productId ? { productId: line.productId } : {}),
          description: line.description,
          detail: line.detail,
          unitAed: line.unitAed,
          quantity: Number.parseInt(line.quantity, 10) || 0,
        })),
      ),
    );
    void run(() => createManualOrder(data), {
      noRefresh: true,
      onSuccess: (result) => {
        const number = String(result.vars?.number ?? "");
        router.push(number ? `/admin/orders/${encodeURIComponent(number)}` : "/admin/orders");
      },
    });
  }

  const paymentChoices: { value: Payment; text: string }[] = [
    { value: "unpaid", text: t("orders.new.payUnpaid") },
    { value: "cash", text: t("orders.new.payCash") },
    { value: "bank-transfer", text: t("orders.new.payTransfer") },
    { value: "card-machine", text: t("orders.new.payMachine") },
  ];

  return (
    /* method="post": before hydration a form with no method is a GET, and
       this one carries a customer's address and phone. */
    <form id={formId} method="post" noValidate onSubmit={onSubmit} className="grid max-w-2xl gap-6">
      <Card as="section">
        <CardHeader title={t("orders.new.customer")} />
        <div className="mt-4 grid gap-5">
          <Field id="mo-name" label={t("orders.new.customerName")} required>
            <Input id="mo-name" name="customerName" maxLength={140} autoComplete="off" />
          </Field>
          <Field id="mo-phone" label={t("orders.new.phone")} required hint={t("orders.new.phoneHint")}>
            <Input
              id="mo-phone"
              name="customerPhone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              withHint
              autoComplete="off"
              placeholder="+971501234567"
            />
          </Field>
          <Field id="mo-email" label={t("orders.new.email")} hint={t("orders.new.emailHint")}>
            <Input
              id="mo-email"
              name="customerEmail"
              type="email"
              dir="ltr"
              withHint
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field id="mo-channel" label={t("orders.new.channel")} required>
            <Select
              id="mo-channel"
              name="salesChannel"
              defaultValue="whatsapp"
              options={CHANNELS.map((value) => ({ value, label: label("salesChannel", value) }))}
            />
          </Field>
        </div>
      </Card>

      <Card as="section">
        <CardHeader title={t("orders.new.items")} />
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">{t("orders.new.noItems")}</p>
        ) : (
          <ol className="m-0 mt-4 grid list-none gap-4 p-0">
            {lines.map((line, index) => {
              const n = index + 1;
              const isProduct = line.productId !== null;
              return (
                <li key={line.key} className="grid gap-4 rounded-md border border-line p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {isProduct ? (
                        <Field id={`mo-product-${line.key}`} label={`${t("orders.new.itemName")} ${n}`} required>
                          <Select
                            id={`mo-product-${line.key}`}
                            value={String(line.productId)}
                            onChange={(e) => chooseProduct(line.key, e.target.value)}
                            options={products.map((p) => ({ value: String(p.id), label: p.name }))}
                          />
                        </Field>
                      ) : (
                        <Field id={`mo-desc-${line.key}`} label={`${t("orders.new.itemName")} ${n}`} required>
                          <Input
                            id={`mo-desc-${line.key}`}
                            maxLength={140}
                            placeholder={t("orders.new.itemNamePlaceholder")}
                            value={line.description}
                            onChange={(e) => patchLine(line.key, { description: e.target.value })}
                          />
                        </Field>
                      )}
                    </div>
                    <IconButton
                      label={t("orders.new.remove", { n })}
                      icon="trash"
                      className="mt-7 shrink-0"
                      onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                    />
                  </div>
                  <Field id={`mo-detail-${line.key}`} label={t("orders.new.itemDetail")}>
                    <Input
                      id={`mo-detail-${line.key}`}
                      maxLength={140}
                      placeholder={t("orders.new.itemDetailPlaceholder")}
                      value={line.detail}
                      onChange={(e) => patchLine(line.key, { detail: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
                    <Field id={`mo-price-${line.key}`} label={t("orders.new.price")} required>
                      <PrefixInput
                        id={`mo-price-${line.key}`}
                        prefix="AED"
                        inputMode="decimal"
                        autoComplete="off"
                        dir="ltr"
                        className="tabular"
                        value={line.unitAed}
                        onChange={(e) => patchLine(line.key, { unitAed: e.target.value })}
                      />
                    </Field>
                    <Field id={`mo-qty-${line.key}`} label={t("orders.new.qty")} required>
                      <Input
                        id={`mo-qty-${line.key}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={999}
                        dir="ltr"
                        className="tabular"
                        value={line.quantity}
                        onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
                      />
                    </Field>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {products.length > 0 ? (
            <Button icon="plus" onClick={() => addLine(products[0] ?? null)} className="max-sm:flex-1">
              {t("orders.new.addProduct")}
            </Button>
          ) : null}
          <Button icon="plus" onClick={() => addLine(null)} className="max-sm:flex-1">
            {t("orders.new.addCustom")}
          </Button>
        </div>

        <p
          aria-live="polite"
          className="mt-5 flex items-baseline justify-between gap-4 border-t border-line pt-4 text-base text-ink"
        >
          <span className="font-medium">{t("orders.new.total")}</span>
          <span className="text-xl font-semibold tabular" dir="ltr">
            {money(totalFils)}
          </span>
        </p>
      </Card>

      <Card as="section">
        <CardHeader title={t("orders.new.delivery")} />
        <div className="mt-4 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="mo-date" label={t("enquiries.quote.deliveryDate")} required>
              <Input id="mo-date" name="deliveryDate" type="date" defaultValue={todayDubai} />
            </Field>
            <Field id="mo-slot" label={t("enquiries.quote.timeSlot")} required>
              <Select
                id="mo-slot"
                name="deliveryTimeSlot"
                dir="ltr"
                defaultValue={slots[0]}
                options={slots.map((slot) => ({ value: slot, label: slot }))}
              />
            </Field>
          </div>
          <Checkbox
            name="pickup"
            checked={pickup}
            onChange={(e) => setPickup(e.target.checked)}
            label={t("orders.new.pickup")}
          />
          {pickup ? null : (
            <Field id="mo-address" label={t("enquiries.quote.address")} required hint={t("enquiries.quote.emirate")}>
              <Textarea id="mo-address" name="deliveryAddress" withHint rows={2} maxLength={600} />
            </Field>
          )}

          <details className="rounded-md border border-line">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-medium text-ink">
              <Icon name="gift" className="h-4 w-4 text-ink-3" />
              {t("enquiries.quote.gift")}
            </summary>
            <div className="grid gap-5 border-t border-line p-3">
              <Field id="mo-recipient" label={t("enquiries.quote.recipientName")}>
                <Input id="mo-recipient" name="recipientName" maxLength={140} />
              </Field>
              <Field id="mo-recipient-phone" label={t("enquiries.quote.recipientPhone")}>
                <Input
                  id="mo-recipient-phone"
                  name="recipientPhone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="+971501234567"
                />
              </Field>
              <Field id="mo-card" label={t("enquiries.quote.cardMessage")}>
                <Textarea id="mo-card" name="cardMessage" rows={2} maxLength={300} />
              </Field>
            </div>
          </details>

          <Field id="mo-note" label={t("enquiries.quote.note")} hint={t("enquiries.quote.noteHint")}>
            <Textarea id="mo-note" name="customerNote" withHint rows={2} maxLength={600} />
          </Field>
          <Field id="mo-locale" label={t("enquiries.quote.language")}>
            <Select
              id="mo-locale"
              name="locale"
              defaultValue={defaultLocale}
              options={[
                { value: "en", label: t("language.en") },
                { value: "ar", label: t("language.ar") },
              ]}
            />
          </Field>
        </div>
      </Card>

      <Card as="section">
        <CardHeader title={t("orders.new.payment")} />
        <fieldset className="m-0 mt-3 grid min-w-0 gap-1 border-0 p-0">
          <legend className="sr-only">{t("orders.new.payment")}</legend>
          {paymentChoices.map((choice) => {
            const locked = choice.value !== "unpaid" && !isOwner;
            return (
              <label
                key={choice.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 py-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55"
              >
                <input
                  type="radio"
                  name="payment"
                  value={choice.value}
                  checked={payment === choice.value}
                  disabled={locked}
                  onChange={() => setPayment(choice.value)}
                  className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
                />
                <span className="text-base text-ink">{choice.text}</span>
              </label>
            );
          })}
        </fieldset>
        {!isOwner ? <p className="mt-2 text-sm text-ink-2">{t("orders.new.ownerOnlyHint")}</p> : null}

        {payment === "unpaid" ? (
          <div className="mt-4 grid gap-3 border-t border-line pt-4">
            <p className="text-sm leading-relaxed text-ink-2">{t("orders.new.payUnpaidHint")}</p>
            {paymentsReady ? (
              <Checkbox
                name="sendEmail"
                defaultChecked
                disabled={!hasEmail}
                label={t("orders.new.sendEmail")}
                hint={hasEmail ? undefined : t("orders.new.sendEmailNoEmail")}
              />
            ) : (
              <Notice tone="warning" className="mb-0">
                {t("orders.new.paymentsOff")}
              </Notice>
            )}
          </div>
        ) : (
          <div className="mt-4 border-t border-line pt-4">
            <Field id="mo-reference" label={t("orders.new.reference")}>
              <Input
                id="mo-reference"
                name="paymentReference"
                maxLength={140}
                placeholder={t("orders.new.referencePlaceholder")}
              />
            </Field>
          </div>
        )}
      </Card>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/[0.08] px-4 py-3 text-sm leading-relaxed text-ink"
        >
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          loadingText={t("common.working")}
          className="max-sm:flex-1"
        >
          {totalFils > 0
            ? t(payment === "unpaid" ? "orders.new.submitUnpaid" : "orders.new.submitPaid", {
                amount: money(totalFils),
              })
            : t("orders.new.submitPlain")}
        </Button>
        <ButtonLink href="/admin/orders" variant="ghost">
          {t("common.cancel")}
        </ButtonLink>
      </div>
    </form>
  );
}
