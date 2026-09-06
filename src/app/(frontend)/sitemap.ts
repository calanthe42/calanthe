import type { MetadataRoute } from "next";
import { occasions, products } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

/**
 * /sitemap.xml
 *
 * Adapted from the v1 storefront rather than copied — three things had
 * changed and a direct port would have shipped errors:
 *
 * - `/refunds` is now `/refund-policy`; the old entry would have been
 *   a 404 in the sitemap.
 * - `/about` and `/events` did not exist in v1.
 * - `/shop/[slug]` now 301s to `/product/[slug]`. Listing a redirect in
 *   a sitemap is a crawl-budget error, so only the canonical
 *   `/product/[slug]` appears.
 *
 * Excluded deliberately: /cart, /checkout, /account, /login, /wishlist
 * (personal or transactional) and /style-check (internal). These are
 * also disallowed in robots.txt.
 */

/* One timestamp per build rather than `new Date()` evaluated per entry.
   Telling search engines that every page changed at a slightly
   different moment on every deploy is noise, and it trains crawlers to
   distrust the field.

   TODO (B2): once products come from the database, use each document's
   real `updatedAt` so lastModified means something. */
const BUILD_TIME = new Date();

type Entry = MetadataRoute.Sitemap[number];

const marketingRoutes: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: Entry["changeFrequency"];
}> = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/shop", priority: 0.9, changeFrequency: "weekly" },
  { path: "/occasions", priority: 0.9, changeFrequency: "monthly" },
  { path: "/build-your-own", priority: 0.8, changeFrequency: "monthly" },
  { path: "/membership", priority: 0.8, changeFrequency: "monthly" },
  { path: "/events", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/delivery", priority: 0.6, changeFrequency: "monthly" },
  { path: "/faqs", priority: 0.6, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refund-policy", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const marketing: MetadataRoute.Sitemap = marketingRoutes.map(
    ({ path, priority, changeFrequency }) => ({
      url: absoluteUrl(path || "/"),
      lastModified: BUILD_TIME,
      changeFrequency,
      priority,
    }),
  );

  const occasionPages: MetadataRoute.Sitemap = occasions.map((occasion) => ({
    url: absoluteUrl(`/occasions/${occasion.slug}`),
    lastModified: BUILD_TIME,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  /* Canonical product URLs only — /shop/[slug] redirects here. */
  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(`/product/${product.slug}`),
    lastModified: BUILD_TIME,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...marketing, ...occasionPages, ...productPages];
}
