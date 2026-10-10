/**
 * The three emails an order produces, sent once Stripe confirms the payment.
 *
 *   customer  confirmation, with the money
 *   owner     new order, with the money and the customer's contact details
 *   florist   job sheet, with the work and NO money
 *
 * Built here rather than inline in the checkout action so the gifting rule
 * is enforced in one place and can be tested without placing an order. The
 * florist's sheet is typed `RecipientFacing`, which has no price fields at
 * all, so the compiler refuses any attempt to put a total on it.
 */
import { floristJobSheet, orderConfirmation, ownerNewOrder } from "./templates";
import type { OrderFacts, OrderLine, PricedOrder, SendRequest } from "./types";

export type OrderEmailInput = {
  orderId: number | string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryEmirate: string;
  /** Already formatted for a human: emails are read, not parsed. */
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryNotes?: string;
  recipientName?: string;
  recipientPhone?: string;
  cardMessage?: string;
  lines: readonly OrderLine[];
  subtotalFils: number;
  deliveryFeeFils: number;
  totalFils: number;
  /* The discount, read from the ORDER'S SNAPSHOT by the caller — never from
     the live discount, which may have changed since the order was placed. */
  couponCode?: string;
  couponDiscountFils?: number;
  /** Sum over the lines of (regular − paid) × quantity. */
  saleSavingsFils?: number;
};

/** Where owner and florist mail goes until the owner supplies real addresses. */
export type InternalAddresses = {
  /** One address or several, comma-separated: every one gets the notice. */
  owner?: string;
  florist?: string;
};

/** The owner notice goes to each address in the list, once. */
export const ownerRecipients = (owner: string | undefined): string[] =>
  [...new Set((owner ?? "").split(",").map((a) => a.trim()).filter(Boolean))];

function facts(input: OrderEmailInput): OrderFacts {
  return {
    orderNumber: input.orderNumber,
    customerName: input.customerName,
    recipientName: input.recipientName,
    deliveryDate: input.deliveryDate,
    deliveryTimeSlot: input.deliveryTimeSlot,
    deliveryEmirate: input.deliveryEmirate,
    deliveryAddress: input.deliveryAddress,
    deliveryNotes: input.deliveryNotes,
    cardMessage: input.cardMessage,
    recipientPhone: input.recipientPhone,
    lines: input.lines,
  };
}

export function buildOrderEmails(
  input: OrderEmailInput,
  internal: InternalAddresses,
): SendRequest[] {
  const base = facts(input);

  const couponFils = input.couponCode ? Math.max(0, input.couponDiscountFils ?? 0) : 0;
  const saleFils = Math.max(0, input.saleSavingsFils ?? 0);

  const priced: PricedOrder = {
    ...base,
    audience: "customer",
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    subtotal: { fils: input.subtotalFils, currency: "AED" },
    deliveryFee: { fils: input.deliveryFeeFils, currency: "AED" },
    total: { fils: input.totalFils, currency: "AED" },
    ...(couponFils > 0 && input.couponCode
      ? { discount: { fils: couponFils, code: input.couponCode } }
      : {}),
    ...(couponFils + saleFils > 0 ? { savings: { fils: couponFils + saleFils } } : {}),
    ...(saleFils > 0 ? { saleSavings: { fils: saleFils } } : {}),
  };

  const requests: SendRequest[] = [
    {
      to: input.customerEmail,
      type: "order-confirmation",
      rendered: orderConfirmation(priced),
      orderId: input.orderId,
      orderNumber: input.orderNumber,
    },
  ];

  for (const to of ownerRecipients(internal.owner)) {
    requests.push({
      to,
      type: "owner-new-order",
      rendered: ownerNewOrder({ ...priced, audience: "owner" }),
      orderId: input.orderId,
      orderNumber: input.orderNumber,
    });
  }

  if (internal.florist) {
    requests.push({
      to: internal.florist,
      type: "florist-job-sheet",
      /* `audience: "florist"` and no money — the type will not allow one. */
      rendered: floristJobSheet({ ...base, audience: "florist" }),
      orderId: input.orderId,
      orderNumber: input.orderNumber,
    });
  }

  return requests;
}

/** Turns an order's stored option rows into one readable line. */
export function describeOptions(
  selected: readonly { label?: string | null; value?: string | null }[] | null | undefined,
): string | undefined {
  if (!selected || selected.length === 0) return undefined;
  const parts = selected
    .map((o) => (o.value ? String(o.value) : o.label ? String(o.label) : ""))
    .filter((p) => p.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : undefined;
}
