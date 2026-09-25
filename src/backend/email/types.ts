/**
 * THE GIFTING RULE, ENFORCED BY THE TYPE SYSTEM.
 *
 * `EMAILS.md` §3: an email a gift RECIPIENT can see must never carry a price.
 * A reviewer remembering that is not a guarantee — someone eventually passes
 * the order object into the recipient template because it is already in
 * scope, and the person receiving flowers learns what they cost.
 *
 * So the money never reaches those functions. `RecipientFacing` has no price
 * field to pass, and `PricedAudience` is a separate union that the recipient
 * templates do not accept. Getting it wrong is a compile error, not a
 * judgement call.
 */

/** Who an email is for. The distinction is what makes the rule checkable. */
export type Audience =
  /** The person who paid. May see everything. */
  | "customer"
  /** The owner. May see everything, including margins. */
  | "owner"
  /** The florist composing it. Sees the work, never the money. */
  | "florist"
  /** The person receiving flowers. Never sees money, ever. */
  | "recipient";

/** Audiences allowed to see money. Note who is absent. */
export type PricedAudience = Extract<Audience, "customer" | "owner">;

export type EmailType =
  | "verify-address"
  | "password-reset"
  | "order-confirmation"
  | "order-status"
  | "owner-new-order"
  | "florist-job-sheet"
  | "enquiry-received";

export type Money = {
  /** Always integer fils. Never a float, never a formatted string. */
  fils: number;
  currency: "AED";
};

export type OrderLine = {
  productName: string;
  quantity: number;
  /** Options as words the reader understands, e.g. "Large, with a vase". */
  options?: string;
};

/**
 * What every email knows about an order, WITHOUT any money in it.
 *
 * This is the base the recipient- and florist-facing templates build on, and
 * it is the reason those templates cannot leak a price: there is nothing
 * here to leak.
 */
export type OrderFacts = {
  orderNumber: string;
  customerName: string;
  recipientName?: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryEmirate: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  cardMessage?: string;
  recipientPhone?: string;
  lines: readonly OrderLine[];
};

/** The same order, with money — only for audiences allowed to see it. */
export type PricedOrder = OrderFacts & {
  audience: PricedAudience;
  subtotal: Money;
  deliveryFee: Money;
  total: Money;
  customerEmail: string;
  customerPhone: string;
};

/**
 * An email whose content is safe for someone who must not learn the price.
 *
 * `never` on the money keys is the guard: an object carrying any of them
 * cannot be assigned here, so passing a PricedOrder into a recipient
 * template does not compile.
 */
export type RecipientFacing = OrderFacts & {
  audience: Extract<Audience, "recipient" | "florist">;
  subtotal?: never;
  deliveryFee?: never;
  total?: never;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  /** Always sent alongside the HTML — a plain-text part is not optional. */
  text: string;
};

export type SendRequest = {
  to: string;
  type: EmailType;
  rendered: RenderedEmail;
  /** Links the log row to the order it belongs to. */
  orderId?: number | string;
  orderNumber?: string;
};

export type SendOutcome = {
  status: "sent" | "failed" | "skipped" | "suppressed";
  /** Resend's message id, which is what proves delivery later. */
  providerId?: string;
  error?: string;
};

export interface EmailProvider {
  readonly name: string;
  send(request: SendRequest, from: string, replyTo?: string): Promise<SendOutcome>;
}
