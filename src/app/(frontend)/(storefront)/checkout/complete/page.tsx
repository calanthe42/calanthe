import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { getStripe } from "@backend/payments/stripe";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";
import { ClearCart } from "./ClearCart";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { robots: { index: false }, title: t.meta.checkout };
}

/**
 * Where Stripe returns a customer after a payment that had to leave the page
 * (a bank's 3-D Secure page, some wallets). READ-ONLY: it asks Stripe for the
 * intent's status to say the right thing; the order is marked paid only by
 * the signed webhook (docs/PAYMENTS.md §2).
 */
export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string; order?: string }>;
}) {
  const { t } = await getDictionary();
  const { payment_intent: intentId, order } = await searchParams;

  let status: string | null = null;
  let orderNumber = order ?? null;
  const stripe = getStripe();
  if (stripe && intentId?.startsWith("pi_")) {
    const intent = await stripe.paymentIntents.retrieve(intentId).catch(() => null);
    status = intent?.status ?? null;
    orderNumber = intent?.metadata?.orderNumber ?? orderNumber;
  }
  const paid = status === "succeeded" || status === "processing";

  return (
    <main className="mx-auto flex min-h-[65svh] max-w-6xl flex-col items-center justify-center gap-6 gutter section-pad text-center">
      {paid && <ClearCart />}
      <Monogram className="w-16 text-burnt-orange" />
      {orderNumber && <Eyebrow>{t.checkout.orderRef.replace("{number}", orderNumber)}</Eyebrow>}
      <h1 className="max-w-lg font-display text-4xl font-light leading-tight text-olive lg:text-5xl">
        {paid ? t.checkout.placedTitle : t.checkout.paymentFailed}
      </h1>
      {paid && <p className="max-w-md text-base leading-relaxed text-ink-muted">{t.checkout.placedBody}</p>}
      <ButtonLink href={paid ? "/shop" : "/checkout"} variant="primary">
        {paid ? t.checkout.continueShopping : t.checkout.place}
      </ButtonLink>
    </main>
  );
}
