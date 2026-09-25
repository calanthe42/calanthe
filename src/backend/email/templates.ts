/**
 * Every email the shop sends.
 *
 * THE RULE THAT SHAPES THIS FILE. A recipient- or florist-facing template
 * takes `RecipientFacing`, which has no money in it and whose money keys are
 * typed `never`. A priced template takes `PricedOrder`. Passing an order
 * with a total into `floristJobSheet` does not compile, so the gifting rule
 * in EMAILS.md §3 is checked by the compiler rather than by a reviewer.
 *
 * The markup is plain and inline-styled on purpose: email clients strip
 * <style> blocks, ignore most modern CSS, and Outlook renders with Word.
 * Brand tokens are written as literal hex here because an email cannot read
 * a CSS custom property.
 */
import type {
  OrderFacts,
  PricedOrder,
  RecipientFacing,
  RenderedEmail,
} from "./types";

/* Brand tokens, literal because email clients cannot resolve variables. */
const OLIVE = "#2B2F1B";
const CREAM = "#E4DCC5";
const CANVAS = "#F3EFDF";
const SAGE = "#868764";
const HAIRLINE = "#CBC4A9";

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatMoney(fils: number): string {
  /* Integers in, words out. Fils never reach a customer. */
  const whole = Math.round(fils) / 100;
  return `AED ${whole.toLocaleString("en-AE", { minimumFractionDigits: whole % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${CANVAS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CREAM};border:1px solid ${HAIRLINE};">
<tr><td style="padding:32px 28px 8px;text-align:center;">
<div style="font-family:Georgia,'Times New Roman',serif;letter-spacing:0.18em;text-transform:uppercase;font-size:15px;color:${OLIVE};">Calanthe</div>
</td></tr>
<tr><td style="padding:16px 28px 8px;">
<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;line-height:1.25;color:${OLIVE};">${escape(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:24px 28px 32px;border-top:1px solid ${HAIRLINE};">
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${SAGE};">Calanthe &middot; Flower atelier, United Arab Emirates</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function para(text: string): string {
  return `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:${OLIVE};">${text}</p>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escape(href)}" style="display:inline-block;background:${OLIVE};color:${CREAM};text-decoration:none;padding:14px 28px;font-family:Georgia,'Times New Roman',serif;letter-spacing:0.18em;text-transform:uppercase;font-size:13px;">${escape(label)}</a></p>`;
}

function factsTable(order: OrderFacts): string {
  const rows: [string, string | undefined][] = [
    ["Order", order.orderNumber],
    ["Delivery", `${order.deliveryDate}, ${order.deliveryTimeSlot}`],
    ["Emirate", order.deliveryEmirate],
    ["Address", order.deliveryAddress],
    ["For", order.recipientName],
    ["Their phone", order.recipientPhone],
    ["Notes", order.deliveryNotes],
  ];
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 18px;">${rows
    .filter(([, v]) => Boolean(v))
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${SAGE};vertical-align:top;white-space:nowrap;">${escape(k)}</td><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${OLIVE};">${escape(String(v))}</td></tr>`,
    )
    .join("")}</table>`;
}

function lineItems(order: OrderFacts): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;">${order.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${HAIRLINE};font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${OLIVE};">${escape(l.productName)}${
          l.options ? `<br><span style="font-size:13px;color:${SAGE};">${escape(l.options)}</span>` : ""
        }</td><td style="padding:8px 0;border-bottom:1px solid ${HAIRLINE};text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${OLIVE};white-space:nowrap;">&times;${l.quantity}</td></tr>`,
    )
    .join("")}</table>`;
}

function factsText(order: OrderFacts): string {
  const bits = [
    `Order: ${order.orderNumber}`,
    `Delivery: ${order.deliveryDate}, ${order.deliveryTimeSlot}`,
    `Emirate: ${order.deliveryEmirate}`,
    `Address: ${order.deliveryAddress}`,
    order.recipientName ? `For: ${order.recipientName}` : null,
    order.recipientPhone ? `Their phone: ${order.recipientPhone}` : null,
    order.deliveryNotes ? `Notes: ${order.deliveryNotes}` : null,
    "",
    ...order.lines.map((l) => `- ${l.productName}${l.options ? ` (${l.options})` : ""} x${l.quantity}`),
  ];
  return bits.filter((b) => b !== null).join("\n");
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export function verifyAddress(input: { name?: string; url: string }): RenderedEmail {
  const greeting = input.name ? `Hello ${escape(input.name)},` : "Hello,";
  return {
    subject: "Confirm your email — Calanthe",
    html: shell(
      "One step to finish",
      para(greeting) +
        para("Confirm this address and your Calanthe account is ready.") +
        button(input.url, "Confirm my email") +
        para(
          `<span style="font-size:13px;color:${SAGE};">If the button does not work, paste this into your browser:<br>${escape(input.url)}</span>`,
        ),
    ),
    text: `${input.name ? `Hello ${input.name},` : "Hello,"}\n\nConfirm this address and your Calanthe account is ready:\n\n${input.url}\n\nIf you did not create an account, ignore this email.\n\nCalanthe`,
  };
}

export function passwordReset(input: { name?: string; url: string }): RenderedEmail {
  const greeting = input.name ? `Hello ${escape(input.name)},` : "Hello,";
  return {
    subject: "Reset your password — Calanthe",
    html: shell(
      "Reset your password",
      para(greeting) +
        para("Choose a new password with the link below. It expires shortly.") +
        button(input.url, "Choose a new password") +
        para(
          `<span style="font-size:13px;color:${SAGE};">If you did not ask for this, nothing has changed and you can ignore this email.</span>`,
        ),
    ),
    text: `${input.name ? `Hello ${input.name},` : "Hello,"}\n\nChoose a new password:\n\n${input.url}\n\nIt expires shortly. If you did not ask for this, nothing has changed.\n\nCalanthe`,
  };
}

/* ------------------------------------------------------------------ */
/* Orders — priced                                                     */
/* ------------------------------------------------------------------ */

export function orderConfirmation(order: PricedOrder): RenderedEmail {
  const totals = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 8px;">
<tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${SAGE};">Subtotal</td><td style="padding:4px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${OLIVE};">${formatMoney(order.subtotal.fils)}</td></tr>
<tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${SAGE};">Delivery</td><td style="padding:4px 0;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${OLIVE};">${order.deliveryFee.fils === 0 ? "Complimentary" : formatMoney(order.deliveryFee.fils)}</td></tr>
<tr><td style="padding:10px 0 0;border-top:1px solid ${HAIRLINE};font-family:Georgia,serif;font-size:15px;color:${OLIVE};">Total</td><td style="padding:10px 0 0;border-top:1px solid ${HAIRLINE};text-align:right;font-family:Georgia,serif;font-size:19px;color:${OLIVE};">${formatMoney(order.total.fils)}</td></tr></table>`;

  return {
    subject: `Order ${order.orderNumber} — Calanthe`,
    html: shell(
      "Your flowers are in our hands",
      para(`Thank you, ${escape(order.customerName)}.`) +
        para(
          "Your florist composes the arrangement by hand and sends a photograph for your approval on WhatsApp before it leaves the atelier.",
        ) +
        factsTable(order) +
        lineItems(order) +
        totals +
        para(
          `<span style="font-size:13px;color:${SAGE};">Payment is taken in cash on delivery. Nothing has been charged.</span>`,
        ),
    ),
    text: `Thank you, ${order.customerName}.\n\nYour florist composes the arrangement by hand and sends a photograph for your approval on WhatsApp before it leaves.\n\n${factsText(order)}\n\nSubtotal: ${formatMoney(order.subtotal.fils)}\nDelivery: ${order.deliveryFee.fils === 0 ? "Complimentary" : formatMoney(order.deliveryFee.fils)}\nTotal: ${formatMoney(order.total.fils)}\n\nPayment is taken in cash on delivery. Nothing has been charged.\n\nCalanthe`,
  };
}

export function ownerNewOrder(order: PricedOrder): RenderedEmail {
  return {
    subject: `New order ${order.orderNumber} — ${formatMoney(order.total.fils)}`,
    html: shell(
      `New order ${order.orderNumber}`,
      para(
        `<strong>${escape(order.customerName)}</strong> &middot; ${escape(order.customerEmail)} &middot; ${escape(order.customerPhone)}`,
      ) +
        factsTable(order) +
        lineItems(order) +
        para(`<strong>Total ${formatMoney(order.total.fils)}</strong> — cash on delivery, not yet collected.`),
    ),
    text: `New order ${order.orderNumber}\n\n${order.customerName}\n${order.customerEmail}\n${order.customerPhone}\n\n${factsText(order)}\n\nTotal: ${formatMoney(order.total.fils)} — cash on delivery, not yet collected.`,
  };
}

/* ------------------------------------------------------------------ */
/* Orders — money-free                                                 */
/* ------------------------------------------------------------------ */

/**
 * "Your flowers are being prepared", and the rest of the journey.
 *
 * Takes `RecipientFacing` — a status update carries no money. The customer
 * already has their confirmation and the total is not news; repeating a
 * price in every update is also one more place it could reach the wrong
 * person.
 */
export function orderStatus(
  order: RecipientFacing,
  status: OrderStatusUpdate,
): RenderedEmail {
  const copy = STATUS_COPY[status];
  return {
    subject: `${copy.subject} — ${order.orderNumber}`,
    html: shell(
      copy.heading,
      para(`Hello ${escape(order.customerName)},`) +
        para(copy.body) +
        factsTable(order) +
        (copy.note ? para(`<span style="font-size:13px;color:${SAGE};">${copy.note}</span>`) : ""),
    ),
    text: `Hello ${order.customerName},\n\n${copy.body.replace(/<[^>]+>/g, "")}\n\n${factsText(order)}\n${
      copy.note ? `\n${copy.note}\n` : ""
    }\nCalanthe`,
  };
}

/** The statuses worth interrupting someone for. */
export type OrderStatusUpdate =
  | "CONFIRMED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

/**
 * NOT every status change emails. READY means "on the bench", which is
 * workshop vocabulary and tells the customer nothing they can act on, and
 * NEW is the state the confirmation already announced. An inbox is a
 * finite resource.
 */
const STATUS_COPY: Record<
  OrderStatusUpdate,
  { subject: string; heading: string; body: string; note?: string }
> = {
  CONFIRMED: {
    subject: "Your order is confirmed",
    heading: "Confirmed",
    body: "Your florist has your order and the flowers are reserved for your delivery day.",
  },
  PREPARING: {
    subject: "Your flowers are being made",
    heading: "Being composed now",
    body: "Your arrangement is being composed by hand in the atelier.",
    note: "You will get a photograph on WhatsApp for your approval before it leaves.",
  },
  OUT_FOR_DELIVERY: {
    subject: "On the way",
    heading: "On the way",
    body: "Your flowers have left the atelier and are on their way.",
    note: "Our courier may call on arrival.",
  },
  DELIVERED: {
    subject: "Delivered",
    heading: "Delivered",
    body: "Your flowers have been delivered. We hope they are exactly right.",
    note: "Payment is taken in cash on delivery.",
  },
  CANCELLED: {
    subject: "Your order has been cancelled",
    heading: "Cancelled",
    body: "This order has been cancelled. Nothing has been charged.",
    note: "If this is unexpected, reply to this email and a florist will look into it.",
  },
};

/** Whether a move to this status is worth an email at all. */
export function isEmailableStatus(status: string): status is OrderStatusUpdate {
  return status in STATUS_COPY;
}

/**
 * The florist's job sheet. Takes `RecipientFacing`, so there is no total to
 * print even by accident: a florist needs the work, not the invoice.
 */
export function floristJobSheet(order: RecipientFacing): RenderedEmail {
  const card = order.cardMessage
    ? `<div style="margin:0 0 18px;padding:16px 18px;background:${CANVAS};border:1px solid ${HAIRLINE};"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${SAGE};margin-bottom:8px;">Card message — copy exactly</div><div style="font-family:Georgia,serif;font-size:17px;line-height:1.5;color:${OLIVE};white-space:pre-wrap;">${escape(order.cardMessage)}</div></div>`
    : "";
  return {
    subject: `Job sheet ${order.orderNumber} — ${order.deliveryDate}`,
    html: shell(
      `Job sheet ${order.orderNumber}`,
      factsTable(order) + lineItems(order) + card,
    ),
    text: `Job sheet ${order.orderNumber}\n\n${factsText(order)}\n${
      order.cardMessage ? `\nCard message — copy exactly:\n${order.cardMessage}\n` : ""
    }`,
  };
}
