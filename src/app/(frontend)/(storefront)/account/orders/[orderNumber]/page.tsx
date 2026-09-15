import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { formatFils } from "@/lib/money";
import { getCustomerSession } from "@backend/actions/account";

export const metadata: Metadata = { title: "Order", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * A customer's own order.
 *
 * The lookup runs under the customer's session, so Payload's ownership
 * constraint applies: another customer's order simply is not found, and an
 * order number guessed from a receipt gets a 404 rather than someone else's
 * address and card message. Internal notes never leave the server — the
 * field is staff-only at field level, so it is not in this document at all.
 */
export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const customer = await getCustomerSession();

/* A signed-out visitor gets an invitation to sign in rather than a redirect.
   The storefront runs with `experimental.globalNotFound`, under which a
   redirect thrown from a page surfaces as the 404 shell — correct in that it
   leaks nothing, but a dead end for a customer who simply is not signed in. */
  if (!customer) {
    return (
      <main className="mx-auto max-w-3xl gutter section-pad">
        <Reveal>
          <Eyebrow>Your order</Eyebrow>
          <h1 className="display-2 mt-3 font-display font-light text-olive">Please sign in.</h1>
          <p className="mt-4 text-base leading-relaxed text-sage">
            Sign in to see this order. Orders are only ever shown to the account that placed them.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-base text-olive underline underline-offset-4"
          >
            Sign in
          </Link>
        </Reveal>
      </main>
    );
  }

  const { orderNumber } = await params;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const result = await payload.find({
    collection: "orders",
    where: { orderNumber: { equals: decodeURIComponent(orderNumber) } },
    limit: 1,
    depth: 0,
    user,
  });

  const order = result.docs[0];
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-3xl gutter section-pad">
      <Reveal className="mb-8">
        <Eyebrow>Your order</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">{order.orderNumber}</h1>
        <p className="mt-2 text-base text-sage">
          Placed{" "}
          {new Date(order.createdAt).toLocaleDateString("en-AE", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · {order.fulfilmentStatus.toLowerCase().replace(/_/g, " ")}
        </p>
      </Reveal>

      <section className="rounded-media border border-hairline bg-cream/30 p-6">
        <h2 className="font-display text-xl font-light text-olive">What you ordered</h2>
        <ul className="mt-4 space-y-3">
          {(order.items ?? []).map((item, i) => (
            <li key={i} className="flex justify-between gap-4 text-base">
              <span className="text-olive">
                {item.productName}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                {(item.selectedOptions ?? []).length > 0 ? (
                  <span className="block text-sm text-sage">
                    {(item.selectedOptions ?? []).map((o) => o.value).join(" · ")}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums text-olive">
                {formatFils(Number(item.lineTotalFils))}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-1.5 border-t border-hairline pt-4 text-base">
          <div className="flex justify-between">
            <dt className="text-sage">Subtotal</dt>
            <dd className="tabular-nums">{formatFils(Number(order.subtotalFils))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sage">Delivery</dt>
            <dd className="tabular-nums">
              {Number(order.deliveryFeeFils) === 0
                ? "Free"
                : formatFils(Number(order.deliveryFeeFils))}
            </dd>
          </div>
          <div className="flex justify-between border-t border-hairline pt-2 text-lg font-medium text-olive">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatFils(Number(order.totalFils))}</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm leading-relaxed text-sage">
          {order.paymentStatus === "PENDING"
            ? "Payable in cash on delivery."
            : `Payment: ${order.paymentStatus.toLowerCase().replace(/_/g, " ")}`}
        </p>
      </section>

      <section className="mt-6 rounded-media border border-hairline bg-cream/30 p-6">
        <h2 className="font-display text-xl font-light text-olive">Delivery</h2>
        {order.recipientName ? (
          <p className="mt-3 text-base text-olive">To {order.recipientName}</p>
        ) : null}
        <p className="mt-1 whitespace-pre-line text-base text-olive">{order.deliveryAddress}</p>
        <p className="mt-2 text-base text-sage">
          {new Date(order.deliveryDate).toLocaleDateString("en-AE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          · {order.deliveryTimeSlot}
        </p>
      </section>

      <Link
        href="/account"
        className="mt-8 inline-block text-sm text-olive underline underline-offset-4"
      >
        Back to your orders
      </Link>
    </main>
  );
}
