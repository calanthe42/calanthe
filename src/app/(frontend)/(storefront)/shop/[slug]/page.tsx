import { redirect } from "next/navigation";

/*
 * RENDERED PER REQUEST, DELIBERATELY.
 *
 * THE OUTAGE THIS FIXES. This route was ISR (`revalidate`) with
 * `generateStaticParams`, and the locale is read with `cookies()`
 * (lib/i18n/server.ts). That combination is only safe for paths Next
 * prerendered at build time. Any other path renders on demand in static
 * mode, where `cookies()` is illegal, and Next throws
 * DYNAMIC_SERVER_USAGE -> 500.
 *
 * Same cause as /product and /occasions: a category page that was not in
 * the build-time set renders on demand and throws DYNAMIC_SERVER_USAGE.
 *
 * `force-dynamic` makes `cookies()` legal, makes `notFound()` a real 404,
 * and means a product published in /admin is live on its next request with
 * no redeploy. The cost is the ISR cache, which is the right trade against
 * a page that returns 500.
 *
 * THIS IS THE SMALL FIX, NOT THE FINAL ONE. A8 moves the locale into the URL
 * (/en, /ar), after which these pages can be static again and
 * `generateStaticParams` comes back. Until then, static generation here is
 * a trap: it works in development, where products are seeded and available,
 * and fails in production, where they are not.
 */
export const dynamic = "force-dynamic";

/** Canonical product URLs live at /product/[slug]. */
export default async function LegacyProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/product/${slug}`);
}
