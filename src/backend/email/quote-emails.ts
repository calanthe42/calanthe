/**
 * The emails of a payment request, in the customer's language.
 *
 *   payment-request     "Your arrangement is confirmed" + the pay button
 *   payment-received    thank you + the INVOICE              (customer)
 *   owner-quote-paid    "paid" notice with the money          (owner, English)
 *   florist-job-sheet   the existing money-free sheet         (florist)
 *
 * THE COPY IS ONE TYPED MAP. `COPY` is declared `satisfies Record<Locale,
 * QuoteCopy>`, so an Arabic string that was forgotten is a compile error
 * rather than an English sentence in an Arabic email. Arabic addresses the
 * reader in the plural throughout ("ادفعوا", "تواصلوا") — the shop writes to
 * everyone, never to one woman.
 *
 * EVERYTHING A PERSON TYPED IS ESCAPED. The name, the address, the florist's
 * description and her note all originate in a form. They are escaped on the
 * way into HTML, and anything bound for a subject line has its line breaks
 * removed, because a newline in a header is how one email becomes two.
 *
 * AMOUNTS are written "AED 650" with Western digits in both languages (the
 * site's convention) and wrapped left-to-right inside Arabic text, so the
 * currency and the number never swap places.
 *
 * NO DELIVERY-SPEED PROMISE appears anywhere here. The date on the email is
 * the date the florist agreed with the customer, and nothing else is implied.
 */
import { formatDate, formatDeliveryDate } from "@/lib/i18n/date";
import type { Locale } from "@/lib/i18n/dictionary";
import { formatFils } from "@/lib/money";
import { CONTACT } from "@/lib/data";
import type { InvoiceView } from "@backend/domain/invoice";
import { describeLines } from "@backend/domain/manual-order";
import type { InternalAddresses } from "./order-emails";
import {
  EMAIL_COLORS,
  button,
  emailFonts,
  escape,
  floristJobSheet,
  para,
  shell,
} from "./templates";
import type { SendRequest } from "./types";

export type QuoteOrderFacts = {
  orderId: number | string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** What the florist called the arrangement. */
  description: string;
  /** ISO. Formatted here, in the reader's language. */
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryAddress: string;
  recipientName?: string;
  recipientPhone?: string;
  cardMessage?: string;
  /** The florist's note to the customer. */
  customerNote?: string;
  totalFils: number;
  /** True when the request had been cancelled before the money arrived. */
  cancelled?: boolean;
};

type QuoteCopy = {
  greeting: string;
  request: {
    subject: string;
    reminderPrefix: string;
    heading: string;
    body: string;
    payNow: string;
    methods: string;
    fallback: string;
    questions: string;
  };
  facts: {
    reference: string;
    arrangement: string;
    delivery: string;
    deliverTo: string;
    recipient: string;
    deliveryFee: string;
    complimentary: string;
    note: string;
    total: string;
  };
  paid: {
    subject: string;
    heading: string;
    thanks: string;
    body: string;
    viewInvoice: string;
  };
  invoice: {
    title: string;
    taxTitle: string;
    number: string;
    date: string;
    order: string;
    billedTo: string;
    description: string;
    qty: string;
    amount: string;
    subtotal: string;
    delivery: string;
    discount: string;
    discountCode: string;
    vatIncluded: string;
    total: string;
    paidByCard: string;
    paidByCash: string;
    paidByBankTransfer: string;
    paidByCardMachine: string;
    trn: string;
    tradeLicence: string;
  };
};

export const COPY = {
  en: {
    greeting: "Hello {name},",
    request: {
      subject: "Your arrangement is confirmed — {amount} to pay",
      reminderPrefix: "Reminder: ",
      heading: "Your arrangement is confirmed",
      body: "Your florist has confirmed your arrangement. Please complete the payment to reserve your flowers.",
      payNow: "Pay now — {amount}",
      methods: "Pay with Apple Pay, Google Pay or card. The link is valid until {date}.",
      fallback: "If the button does not work, paste this into your browser:",
      questions: "Questions? Reply to this email or message us on WhatsApp {number}.",
    },
    facts: {
      reference: "Reference",
      arrangement: "Arrangement",
      delivery: "Delivery",
      deliverTo: "Deliver to",
      recipient: "For",
      deliveryFee: "Delivery fee",
      complimentary: "Complimentary",
      note: "A note from your florist",
      total: "Total",
    },
    paid: {
      subject: "Thank you — your invoice {number}",
      heading: "Thank you. Your payment is received.",
      thanks: "Thank you, {name}.",
      body: "Your florist composes the arrangement by hand and sends a photograph for your approval on WhatsApp before it leaves the atelier.",
      viewInvoice: "View invoice",
    },
    invoice: {
      title: "Invoice",
      taxTitle: "Tax invoice",
      number: "Invoice no.",
      date: "Date",
      order: "Order",
      billedTo: "Billed to",
      description: "Description",
      qty: "Qty",
      amount: "Amount",
      subtotal: "Subtotal",
      delivery: "Delivery",
      discount: "Discount",
      discountCode: "Discount ({code})",
      vatIncluded: "Includes VAT ({rate}%)",
      total: "Total",
      paidByCard: "Paid by card on {date}",
      paidByCash: "Paid in cash on {date}",
      paidByBankTransfer: "Paid by bank transfer on {date}",
      paidByCardMachine: "Paid by card on {date}",
      trn: "TRN {trn}",
      tradeLicence: "Trade licence {number}",
    },
  },
  ar: {
    greeting: "مرحبًا {name}،",
    request: {
      subject: "تم تأكيد تنسيقكم — المبلغ المطلوب {amount}",
      reminderPrefix: "تذكير: ",
      heading: "تم تأكيد تنسيقكم",
      body: "أكّد منسّق الزهور تنسيقكم. يُرجى إتمام الدفع لحجز زهوركم.",
      payNow: "ادفعوا الآن — {amount}",
      methods: "ادفعوا عبر Apple Pay أو Google Pay أو البطاقة. الرابط صالح حتى {date}.",
      fallback: "إن لم يعمل الزر، انسخوا هذا الرابط في المتصفح:",
      questions: "لأي استفسار، ردّوا على هذه الرسالة أو تواصلوا معنا عبر واتساب {number}.",
    },
    facts: {
      reference: "المرجع",
      arrangement: "التنسيق",
      delivery: "التوصيل",
      deliverTo: "عنوان التوصيل",
      recipient: "المستلِم",
      deliveryFee: "رسوم التوصيل",
      complimentary: "مجاني",
      note: "ملاحظة من منسّق الزهور",
      total: "الإجمالي",
    },
    paid: {
      subject: "شكرًا لكم — فاتورتكم {number}",
      heading: "شكرًا لكم. استلمنا دفعتكم.",
      thanks: "شكرًا لكم، {name}.",
      body: "يُعدّ منسّق الزهور تنسيقكم يدويًا ويرسل لكم صورة عبر واتساب لموافقتكم قبل خروجه من الأتيليه.",
      viewInvoice: "عرض الفاتورة",
    },
    invoice: {
      title: "فاتورة",
      taxTitle: "فاتورة ضريبية",
      number: "رقم الفاتورة",
      date: "التاريخ",
      order: "الطلب",
      billedTo: "الفاتورة إلى",
      description: "الوصف",
      qty: "الكمية",
      amount: "المبلغ",
      subtotal: "المجموع الفرعي",
      delivery: "التوصيل",
      discount: "الخصم",
      discountCode: "الخصم ({code})",
      vatIncluded: "يشمل ضريبة القيمة المضافة ({rate}%)",
      total: "الإجمالي",
      paidByCard: "مدفوعة بالبطاقة بتاريخ {date}",
      paidByCash: "مدفوعة نقداً بتاريخ {date}",
      paidByBankTransfer: "مدفوعة بتحويل بنكي بتاريخ {date}",
      paidByCardMachine: "مدفوعة بالبطاقة بتاريخ {date}",
      trn: "الرقم الضريبي {trn}",
      tradeLicence: "الرخصة التجارية {number}",
    },
  },
} satisfies Record<Locale, QuoteCopy>;

const { olive: OLIVE, sage: SAGE, hairline: HAIRLINE, canvas: CANVAS } = EMAIL_COLORS;

const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);

/** For a subject line: one line, whatever was typed. */
const headerSafe = (value: string): string => value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

/** "AED 650" for markup: kept left-to-right inside Arabic text. */
const moneyHtml = (fils: number, locale: Locale): string =>
  locale === "ar" ? `<span dir="ltr">${formatFils(fils)}</span>` : formatFils(fils);

/** Latin-script values (references, phone numbers, URLs) inside Arabic text. */
const ltr = (value: string, locale: Locale): string =>
  locale === "ar" ? `<span dir="ltr">${escape(value)}</span>` : escape(value);

/** 500 basis points → "5". */
const ratePercent = (rateBps: number): string => String(rateBps / 100);

type Row = [label: string, html: string | undefined];

/** Label/value rows. Values are ALREADY escaped markup. */
function rowsTable(rows: readonly Row[], locale: Locale): string {
  const font = emailFonts(locale).body;
  const gap = locale === "ar" ? "padding:6px 0 6px 12px;" : "padding:6px 12px 6px 0;";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 18px;">${rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(
      ([label, html]) =>
        `<tr><td style="${gap}font-family:${font};font-size:13px;color:${SAGE};vertical-align:top;white-space:nowrap;">${escape(label)}</td><td style="padding:6px 0;font-family:${font};font-size:15px;color:${OLIVE};">${html}</td></tr>`,
    )
    .join("")}</table>`;
}

function deliveryLine(order: QuoteOrderFacts, locale: Locale): string {
  return `${formatDeliveryDate(locale, order.deliveryDate)}, ${order.deliveryTimeSlot}`;
}

/* ------------------------------------------------------------------ */
/* 1. Payment request                                                  */
/* ------------------------------------------------------------------ */

export function buildPaymentRequestEmail(input: {
  order: QuoteOrderFacts;
  payUrl: string;
  expiresAt: Date;
  locale: Locale;
  /** A second or later send: the subject says so. */
  reminder?: boolean;
}): SendRequest {
  const { order, payUrl, locale } = input;
  const c = COPY[locale];
  const amount = formatFils(order.totalFils);
  const expires = formatDate(locale, input.expiresAt);
  const name = headerSafe(order.customerName);

  const note = order.customerNote
    ? `<div style="margin:0 0 18px;padding:14px 16px;background:${CANVAS};border:1px solid ${HAIRLINE};"><div style="font-family:${emailFonts(locale).body};font-size:13px;color:${SAGE};margin-bottom:6px;">${escape(c.facts.note)}</div><div style="font-family:${emailFonts(locale).body};font-size:15px;line-height:1.6;color:${OLIVE};white-space:pre-wrap;">${escape(order.customerNote)}</div></div>`
    : "";

  const html = shell(
    c.request.heading,
    para(escape(fill(c.greeting, { name })), locale) +
      para(escape(c.request.body), locale) +
      rowsTable(
        [
          [c.facts.reference, ltr(order.orderNumber, locale)],
          [c.facts.arrangement, escape(order.description)],
          [c.facts.delivery, escape(deliveryLine(order, locale))],
          [c.facts.deliverTo, escape(order.deliveryAddress)],
          [c.facts.deliveryFee, escape(c.facts.complimentary)],
          [c.facts.total, `<strong>${moneyHtml(order.totalFils, locale)}</strong>`],
        ],
        locale,
      ) +
      note +
      button(payUrl, fill(c.request.payNow, { amount }), locale) +
      para(escape(fill(c.request.methods, { date: expires })), locale) +
      /* No raw address in the HTML: the customer sees the bill and one button.
         The plain-text part below keeps the link for mail apps without buttons. */
      para(
        `<span style="font-size:13px;color:${SAGE};">${fill(escape(c.request.questions), { number: ltr(CONTACT.whatsapp, locale) })}</span>`,
        locale,
      ),
    locale,
  );

  const text = [
    fill(c.greeting, { name }),
    "",
    c.request.body,
    "",
    `${c.facts.reference}: ${order.orderNumber}`,
    `${c.facts.arrangement}: ${order.description}`,
    `${c.facts.delivery}: ${deliveryLine(order, locale)}`,
    `${c.facts.deliverTo}: ${order.deliveryAddress}`,
    `${c.facts.deliveryFee}: ${c.facts.complimentary}`,
    ...(order.customerNote ? [`${c.facts.note}: ${order.customerNote}`] : []),
    `${c.facts.total}: ${amount}`,
    "",
    fill(c.request.payNow, { amount }),
    payUrl,
    "",
    fill(c.request.methods, { date: expires }),
    fill(c.request.questions, { number: CONTACT.whatsapp }),
    "",
    "Calanthe",
  ].join("\n");

  return {
    to: order.customerEmail,
    type: "payment-request",
    rendered: {
      subject: headerSafe(
        `${input.reminder ? c.request.reminderPrefix : ""}${fill(c.request.subject, { amount })}`,
      ),
      html,
      text,
    },
    orderId: order.orderId,
    orderNumber: order.orderNumber,
  };
}

/* ------------------------------------------------------------------ */
/* The invoice, from the same view the /pay page renders               */
/* ------------------------------------------------------------------ */

/** Which sentence says how an invoice was paid. */
const PAID_BY_KEY = {
  card: "paidByCard",
  cash: "paidByCash",
  "bank-transfer": "paidByBankTransfer",
  "card-machine": "paidByCardMachine",
} as const;

function sellerLines(invoice: InvoiceView, locale: Locale): string[] {
  const c = COPY[locale].invoice;
  const s = invoice.seller;
  return [
    s.tradingName,
    ...(s.legalName ? [s.legalName[locale]] : []),
    ...(s.addressLines ? s.addressLines[locale] : []),
    `${s.city[locale]}, ${s.country[locale]}`,
    ...(s.tradeLicence ? [fill(c.tradeLicence, { number: s.tradeLicence })] : []),
    ...(s.trn ? [fill(c.trn, { trn: s.trn })] : []),
    s.email,
    s.phone,
  ];
}

function discountLabel(invoice: InvoiceView, locale: Locale): string {
  const c = COPY[locale].invoice;
  return invoice.discount?.code ? fill(c.discountCode, { code: invoice.discount.code }) : c.discount;
}

/** The invoice block as email markup. Exported so it can be tested alone. */
export function invoiceHtml(invoice: InvoiceView, locale: Locale): string {
  const c = COPY[locale].invoice;
  const fonts = emailFonts(locale);
  const start = locale === "ar" ? "right" : "left";
  const end = locale === "ar" ? "left" : "right";
  const cell = `padding:8px 0;border-bottom:1px solid ${HAIRLINE};font-family:${fonts.body};font-size:15px;color:${OLIVE};`;
  const head = `padding:6px 0;border-bottom:1px solid ${HAIRLINE};font-family:${fonts.body};font-size:12px;color:${SAGE};font-weight:400;`;
  const totalRow = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:${strong ? "10px 0 0" : "4px 0"};${strong ? `border-top:1px solid ${HAIRLINE};` : ""}font-family:${fonts.body};font-size:${strong ? 15 : 14}px;color:${strong ? OLIVE : SAGE};text-align:${start};">${escape(label)}</td><td style="padding:${strong ? "10px 0 0" : "4px 0"};${strong ? `border-top:1px solid ${HAIRLINE};` : ""}text-align:${end};font-family:${fonts.body};font-size:${strong ? 19 : 14}px;color:${OLIVE};white-space:nowrap;">${value}</td></tr>`;

  const lines = invoice.lines
    .map(
      (line) =>
        `<tr><td style="${cell}text-align:${start};">${escape(line.description)}${
          line.detail ? `<br><span style="font-size:13px;color:${SAGE};">${escape(line.detail)}</span>` : ""
        }</td><td style="${cell}text-align:center;white-space:nowrap;">${line.quantity}</td><td style="${cell}text-align:${end};white-space:nowrap;">${moneyHtml(line.totalFils, locale)}</td></tr>`,
    )
    .join("");

  return `<div style="margin:8px 0 18px;padding:18px 18px 14px;background:${CANVAS};border:1px solid ${HAIRLINE};">
<div style="font-family:${fonts.display};font-size:19px;color:${OLIVE};margin:0 0 6px;">${escape(invoice.vat ? c.taxTitle : c.title)}</div>
${rowsTable(
  [
    [c.number, ltr(invoice.number, locale)],
    [c.date, escape(formatDate(locale, invoice.issuedAt))],
    [c.order, ltr(invoice.orderNumber, locale)],
    [c.billedTo, `${escape(invoice.billTo.name)}<br>${ltr(invoice.billTo.email, locale)}`],
  ],
  locale,
)}
<table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 12px;border-collapse:collapse;">
<tr><th style="${head}text-align:${start};">${escape(c.description)}</th><th style="${head}text-align:center;">${escape(c.qty)}</th><th style="${head}text-align:${end};">${escape(c.amount)}</th></tr>
${lines}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 10px;">
${totalRow(c.subtotal, moneyHtml(invoice.subtotalFils, locale))}
${totalRow(
  c.delivery,
  invoice.deliveryFeeFils === 0
    ? escape(COPY[locale].facts.complimentary)
    : moneyHtml(invoice.deliveryFeeFils, locale),
)}
${invoice.discount ? totalRow(discountLabel(invoice, locale), `&minus;${moneyHtml(invoice.discount.fils, locale)}`) : ""}
${invoice.vat ? totalRow(fill(c.vatIncluded, { rate: ratePercent(invoice.vat.rateBps) }), moneyHtml(invoice.vat.includedFils, locale)) : ""}
${totalRow(c.total, moneyHtml(invoice.totalFils, locale), true)}
</table>
<p style="margin:0 0 12px;font-family:${fonts.body};font-size:13px;color:${SAGE};">${escape(fill(c[PAID_BY_KEY[invoice.paymentMethod]], { date: formatDate(locale, invoice.paidAt) }))}</p>
<p style="margin:0;font-family:${fonts.body};font-size:13px;line-height:1.6;color:${SAGE};">${sellerLines(invoice, locale)
    .map((line, index) => (index === 0 ? escape(line) : /[@+]/.test(line) ? ltr(line, locale) : escape(line)))
    .join("<br>")}</p>
</div>`;
}

/** The same invoice for the plain-text part. */
export function invoiceText(invoice: InvoiceView, locale: Locale): string {
  const c = COPY[locale].invoice;
  return [
    invoice.vat ? c.taxTitle : c.title,
    `${c.number}: ${invoice.number}`,
    `${c.date}: ${formatDate(locale, invoice.issuedAt)}`,
    `${c.order}: ${invoice.orderNumber}`,
    `${c.billedTo}: ${invoice.billTo.name} (${invoice.billTo.email})`,
    "",
    ...invoice.lines.map(
      (line) =>
        `- ${line.description}${line.detail ? ` (${line.detail})` : ""} x${line.quantity}: ${formatFils(line.totalFils)}`,
    ),
    "",
    `${c.subtotal}: ${formatFils(invoice.subtotalFils)}`,
    `${c.delivery}: ${
      invoice.deliveryFeeFils === 0 ? COPY[locale].facts.complimentary : formatFils(invoice.deliveryFeeFils)
    }`,
    ...(invoice.discount ? [`${discountLabel(invoice, locale)}: -${formatFils(invoice.discount.fils)}`] : []),
    ...(invoice.vat
      ? [
          `${fill(c.vatIncluded, { rate: ratePercent(invoice.vat.rateBps) })}: ${formatFils(invoice.vat.includedFils)}`,
        ]
      : []),
    `${c.total}: ${formatFils(invoice.totalFils)}`,
    fill(c[PAID_BY_KEY[invoice.paymentMethod]], { date: formatDate(locale, invoice.paidAt) }),
    "",
    ...sellerLines(invoice, locale),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* 2–4. Paid: customer invoice, owner notice, florist job sheet         */
/* ------------------------------------------------------------------ */

function paymentReceivedEmail(
  order: QuoteOrderFacts,
  invoice: InvoiceView,
  payUrl: string,
  locale: Locale,
): SendRequest {
  const c = COPY[locale];
  const name = headerSafe(order.customerName);

  const html = shell(
    c.paid.heading,
    para(escape(fill(c.paid.thanks, { name })), locale) +
      para(escape(c.paid.body), locale) +
      rowsTable(
        [
          [c.facts.delivery, escape(deliveryLine(order, locale))],
          [c.facts.deliverTo, escape(order.deliveryAddress)],
          [c.facts.recipient, order.recipientName ? escape(order.recipientName) : undefined],
        ],
        locale,
      ) +
      invoiceHtml(invoice, locale) +
      button(payUrl, c.paid.viewInvoice, locale),
    locale,
  );

  const text = [
    fill(c.paid.thanks, { name }),
    "",
    c.paid.body,
    "",
    `${c.facts.delivery}: ${deliveryLine(order, locale)}`,
    `${c.facts.deliverTo}: ${order.deliveryAddress}`,
    ...(order.recipientName ? [`${c.facts.recipient}: ${order.recipientName}`] : []),
    "",
    invoiceText(invoice, locale),
    "",
    c.paid.viewInvoice,
    payUrl,
    "",
    "Calanthe",
  ].join("\n");

  return {
    to: order.customerEmail,
    type: "payment-received",
    rendered: {
      subject: headerSafe(fill(c.paid.subject, { number: invoice.number })),
      html,
      text,
    },
    orderId: order.orderId,
    orderNumber: order.orderNumber,
  };
}

/** How the money arrived, in the owner's notice (always English, like the rest of it). */
const OWNER_PAID_BY = {
  card: "paid by card (Stripe)",
  cash: "recorded as paid in cash",
  "bank-transfer": "recorded as paid by bank transfer",
  "card-machine": "recorded as paid on the card machine",
} as const;

/** Said to the owner when money arrives on a request that was cancelled. */
const PAID_AFTER_CANCEL =
  "This request was cancelled before the payment arrived. Refund the payment in Stripe — do not reinstate the order.";

/** Internal, and English like every other owner email. */
function ownerQuotePaidEmail(
  order: QuoteOrderFacts,
  invoice: InvoiceView,
  to: string,
  extra: { enquiryNumber?: string; adminOrderUrl?: string },
): SendRequest {
  const amount = formatFils(order.totalFils);
  const en = COPY.en;
  const origin = extra.enquiryNumber ? `bespoke, ${extra.enquiryNumber}` : "bespoke";

  const html = shell(
    `Paid: ${order.orderNumber}`,
    (order.cancelled ? para(`<strong>${escape(PAID_AFTER_CANCEL)}</strong>`) : "") +
      para(
        `<strong>${escape(order.customerName)}</strong> &middot; ${escape(order.customerEmail)} &middot; ${escape(order.customerPhone)}`,
      ) +
      rowsTable(
        [
          ["Order", escape(order.orderNumber)],
          ["Enquiry", extra.enquiryNumber ? escape(extra.enquiryNumber) : undefined],
          [en.facts.arrangement, escape(order.description)],
          [en.facts.delivery, escape(deliveryLine(order, "en"))],
          ["Address", escape(order.deliveryAddress)],
          ["For", order.recipientName ? escape(order.recipientName) : undefined],
          ["Their phone", order.recipientPhone ? escape(order.recipientPhone) : undefined],
        ],
        "en",
      ) +
      para(
        `<strong>Total ${amount}</strong> — ${OWNER_PAID_BY[invoice.paymentMethod]}. Invoice ${escape(invoice.number)}.`,
      ) +
      (extra.adminOrderUrl ? button(extra.adminOrderUrl, "Open the order") : ""),
  );

  const text = [
    ...(order.cancelled ? [PAID_AFTER_CANCEL, ""] : []),
    `Paid: ${order.orderNumber}`,
    "",
    order.customerName,
    order.customerEmail,
    order.customerPhone,
    "",
    ...(extra.enquiryNumber ? [`Enquiry: ${extra.enquiryNumber}`] : []),
    `${en.facts.arrangement}: ${order.description}`,
    `${en.facts.delivery}: ${deliveryLine(order, "en")}`,
    `Address: ${order.deliveryAddress}`,
    ...(order.recipientName ? [`For: ${order.recipientName}`] : []),
    ...(order.recipientPhone ? [`Their phone: ${order.recipientPhone}`] : []),
    "",
    `Total: ${amount} — ${OWNER_PAID_BY[invoice.paymentMethod]}. Invoice ${invoice.number}.`,
    ...(extra.adminOrderUrl ? ["", extra.adminOrderUrl] : []),
  ].join("\n");

  return {
    to,
    type: "owner-quote-paid",
    rendered: {
      subject: headerSafe(`Paid: ${order.orderNumber} — ${amount} (${origin})`),
      html,
      text,
    },
    orderId: order.orderId,
    orderNumber: order.orderNumber,
  };
}

export function buildQuotePaidEmails(
  input: {
    order: QuoteOrderFacts;
    invoice: InvoiceView;
    payUrl: string;
    enquiryNumber?: string;
    /** Link to the order in /admin, for the owner's notice. */
    adminOrderUrl?: string;
    locale: Locale;
  },
  internal: InternalAddresses,
): SendRequest[] {
  const { order, invoice, payUrl, locale } = input;

  const requests: SendRequest[] = [paymentReceivedEmail(order, invoice, payUrl, locale)];

  if (internal.owner) {
    requests.push(
      ownerQuotePaidEmail(order, invoice, internal.owner, {
        enquiryNumber: input.enquiryNumber,
        adminOrderUrl: input.adminOrderUrl,
      }),
    );
  }

  if (internal.florist) {
    requests.push({
      to: internal.florist,
      type: "florist-job-sheet",
      /* The florist's "paid, go". `RecipientFacing` has no money in it, so
         the amount cannot reach this sheet even by accident. The enquiry's
         brief is not repeated here: she opens the enquiry from the admin. */
      rendered: floristJobSheet({
        audience: "florist",
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        deliveryDate: formatDeliveryDate("en", order.deliveryDate),
        deliveryTimeSlot: order.deliveryTimeSlot,
        deliveryEmirate: "Abu Dhabi",
        deliveryAddress: order.deliveryAddress,
        cardMessage: order.cardMessage,
        lines: [{ productName: order.description, quantity: 1 }],
      }),
      orderId: order.orderId,
      orderNumber: order.orderNumber,
    });
  }

  return requests;
}

/** A saved quote order, as the facts these emails need. */
export function quoteFactsFromOrder(order: {
  id: number | string;
  orderNumber?: string | number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryAddress: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  cardMessage?: string | null;
  customerNote?: string | null;
  totalFils: number;
  fulfilmentStatus?: string | null;
  items?: readonly { productName: string; quantity?: number | null }[] | null;
}): QuoteOrderFacts {
  return {
    orderId: order.id,
    orderNumber: String(order.orderNumber ?? ""),
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    description: describeLines(order.items),
    deliveryDate: order.deliveryDate,
    deliveryTimeSlot: order.deliveryTimeSlot,
    deliveryAddress: order.deliveryAddress,
    ...(order.recipientName ? { recipientName: order.recipientName } : {}),
    ...(order.recipientPhone ? { recipientPhone: order.recipientPhone } : {}),
    ...(order.cardMessage ? { cardMessage: order.cardMessage } : {}),
    ...(order.customerNote ? { customerNote: order.customerNote } : {}),
    totalFils: order.totalFils,
    cancelled: order.fulfilmentStatus === "CANCELLED",
  };
}
