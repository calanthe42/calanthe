import type { MetadataRoute } from "next";
import { IS_PRODUCTION_DEPLOYMENT, absoluteUrl } from "@/lib/site";

/**
 * /robots.txt
 *
 * Two jobs the v1 version did not do:
 *
 * 1. Keep crawlers out of the Payload admin, the API, and every
 *    personal or transactional route. `/admin` in particular must
 *    never be crawled — it is an authenticated surface and indexing it
 *    advertises the CMS to anyone scanning search results.
 * 2. Refuse indexing entirely on preview deployments. A Vercel preview
 *    URL serving the same pages competes with the real site for the
 *    same queries.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_DEPLOYMENT) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        /* Authenticated surfaces: the business admin and the Payload CMS
           behind it. Neither may be crawled. */
        "/admin",
        "/cms",
        "/api/",

        /* Personal and transactional: nothing to index, and every one
           of them is either empty or private to a single visitor */
        "/account",
        "/cart",
        "/checkout",
        "/login",
        "/wishlist",

        /* /shop/[slug] 301s to /product/[slug]; crawling it wastes
           budget on redirects that resolve to pages already listed */
        "/shop/",

        /* Internal design reference */
        "/style-check",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl(""),
  };
}
