import type { Metadata } from "next";
import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { CustomerLogout } from "@/components/commerce/CustomerLogout";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { formatFils } from "@/lib/money";
import { getCustomerSession } from "@backend/actions/account";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The customer's own orders.
 *
 * Read with the customer's own session, so Payload's ownership constraint
 * does the filtering: `orders.read` resolves to a query on `customer`, and a
 * customer cannot see another customer's order however they ask.
 */
export default async function AccountPage() {
  const customer = await getCustomerSession();
  const { t } = await getDictionary();

/* A signed-out visitor gets an invitation to sign in rather than a redirect.
   The storefront runs with `experimental.globalNotFound`, under which a
   redirect thrown from a page surfaces as the 404 shell — correct in that it
   leaks nothing, but a dead end for a customer who simply is not signed in. */
  if (!customer) {
    return (
      <main className="mx-auto max-w-6xl gutter section-pad">
        <Reveal className="max-w-md">
          <Eyebrow>{t.account.eyebrow}</Eyebrow>
          <h1 className="display-2 mt-3 font-display font-light text-olive">
            {t.account.signInTitle}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Sign in to see your orders. You do not need an account to buy — every arrangement
            can be ordered as a guest.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/account/login" className="whitespace-nowrap">
              {t.account.signIn}
            </ButtonLink>
            <ButtonLink
              href="/account/register"
              variant="secondary"
              className="whitespace-nowrap"
            >
              {t.account.createAccount}
            </ButtonLink>
          </div>
        </Reveal>
      </main>
    );
  }

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const orders = await payload.find({
    collection: "orders",
    sort: "-createdAt",
    limit: 50,
    depth: 0,
    user,
    /*
     * WITHOUT THIS, THIS PAGE LISTED EVERY ORDER IN THE DATABASE.
     *
     * Payload's Local API defaults `overrideAccess` to TRUE — it assumes
     * server-side code is trusted and skips access control. Passing `user`
     * alone does not enforce anything; it only tells Payload who is asking.
     * So `orders.read`, which resolves to `{ customer: { equals: user.id } }`,
     * was never consulted, and a customer who had just registered saw another
     * person's order — name, address, phone and total.
     *
     * Found on production on 2026-09-25 by signing in as a brand-new account
     * and being shown CAL-000001, a guest order belonging to someone else.
     */
    overrideAccess: false,
  });

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;

  return (
    <main className="mx-auto max-w-6xl gutter section-pad">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{t.account.eyebrow}</Eyebrow>
          <h1 className="display-2 mt-3 font-display font-light text-olive">{name}</h1>
          <p className="mt-2 text-base text-ink-muted">{customer.email}</p>
        </div>
        <CustomerLogout />
      </Reveal>

      <h2 className="mb-4 font-display text-2xl font-light text-olive">Your orders</h2>

      {orders.docs.length === 0 ? (
        <div className="rounded-media border border-hairline bg-cream/40 px-6 py-14 text-center">
          <p className="font-display text-xl font-light text-olive">No orders yet</p>
          <p className="mx-auto mt-2 max-w-sm text-base leading-relaxed text-ink-muted">
            When you order, it will appear here with its progress.
          </p>
          <Link href="/shop" className="mt-4 inline-block text-sm text-olive underline underline-offset-4">
            Visit the shop
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.docs.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.orderNumber}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-media border border-hairline bg-cream/30 px-5 py-4 transition-colors hover:bg-cream/60"
              >
                <div>
                  <p className="font-medium text-olive">{order.orderNumber}</p>
                  <p className="text-sm text-ink-muted">
                    {new Date(order.createdAt).toLocaleDateString("en-AE", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-olive">{formatFils(Number(order.totalFils))}</p>
                  <p className="text-sm text-ink-muted">
                    {order.fulfilmentStatus.toLowerCase().replace(/_/g, " ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
