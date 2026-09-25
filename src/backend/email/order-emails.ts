/**
 * The three emails a cash-on-delivery order produces.
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
};

/** Where owner and florist mail goes until the owner supplies real addresses. */
export type InternalAddresses = {
  owner?: string;
  florist?: string;
};

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

  const priced: PricedOrder = {
    ...base,
    audience: "customer",
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    subtotal: { fils: input.subtotalFils, currency: "AED" },
    deliveryFee: { fils: input.deliveryFeeFils, currency: "AED" },
    total: { fils: input.totalFils, currency: "AED" },
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

  if (internal.owner) {
    requests.push({
      to: internal.owner,
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
