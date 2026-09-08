import Link from "next/link";
import { formatFils } from "@/lib/money";
import {
  ActionLink,
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  humanStatus,
} from "@admin/components/ui";
import { getAdminProducts } from "@backend/data/admin-metrics";

/**
 * The catalogue as the owner sees it — including hidden products, which is
 * the whole difference from the storefront query.
 *
 * MONEY IS SHOWN IN AED. The database stores integer fils and that does not
 * change; `formatFils` converts at the edge. Nobody in this business thinks
 * in fils, and "48000" on a price column is how a product gets listed at a
 * hundred times its price.
 */

export const metadata = { title: "Products" };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const all = await getAdminProducts();

  const query = q.trim().toLowerCase();
  const products = query
    ? all.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.slug.toLowerCase().includes(query) ||
          (p.shortDescription ?? "").toLowerCase().includes(query),
      )
    : all;

  const hidden = all.filter((p) => !p.available).length;

  return (
    <>
      <PageHeader
        title="Products"
        breadcrumb={[{ label: "Shop" }, { label: "Products" }]}
        description={
          all.length === 0
            ? undefined
            : `${all.length} arrangement${all.length === 1 ? "" : "s"}${
                hidden > 0 ? ` · ${hidden} hidden from the shop` : ""
              }`
        }
        action={
          <ActionLink href="/cms/collections/products/create" variant="primary">
            Add product
          </ActionLink>
        }
      />

      <form action="/admin/products" className="mb-5 max-w-sm">
        <label htmlFor="product-search" className="sr-only">
          Search products
        </label>
        <input
          id="product-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name…"
          className="h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive placeholder:text-sage/70"
        />
      </form>

      {all.length === 0 ? (
        <EmptyState
          title="No products yet"
          message="Your arrangements will appear here once you add the first one."
          action={
            <ActionLink href="/cms/collections/products/create" variant="primary">
              Add your first product
            </ActionLink>
          }
        />
      ) : products.length === 0 ? (
        <EmptyState
          title="Nothing matches that search"
          message={`No product matches “${q}”. Try a shorter word.`}
          action={<ActionLink href="/admin/products">Clear search</ActionLink>}
        />
      ) : (
        <Table head={["Product", "Price", "Category", "Visibility", "Highlights", "Photos"]}>
          {products.map((product) => {
            const photos = (product.images ?? []).length;
            const legacy = (product.legacyImages ?? []).length;
            return (
              <tr key={product.id} className="border-b border-hairline/50 last:border-0">
                <Td>
                  <Link
                    href={`/cms/collections/products/${product.id}`}
                    className="font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="block text-xs text-sage">/{product.slug}</span>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {formatFils(Number(product.priceFils))}
                </Td>
                <Td className="whitespace-nowrap text-sage">{humanStatus(product.category)}</Td>
                <Td>
                  {product.available ? (
                    <StatusBadge value="DELIVERED" kind="fulfilment" />
                  ) : (
                    <span className="inline-flex whitespace-nowrap rounded-sm bg-olive/10 px-2 py-0.5 text-[11px] font-medium text-olive">
                      Hidden
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="flex flex-wrap gap-1 text-[11px] text-sage">
                    {product.featured ? <span>Featured</span> : null}
                    {product.newArrival ? <span>· New</span> : null}
                    {product.bestseller ? <span>· Bestseller</span> : null}
                    {!product.featured && !product.newArrival && !product.bestseller ? (
                      <span>—</span>
                    ) : null}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-sage">
                  {photos > 0 ? (
                    `${photos} photo${photos === 1 ? "" : "s"}`
                  ) : (
                    <span className="text-burnt-orange">
                      None yet{legacy > 0 ? ` (${legacy} to replace)` : ""}
                    </span>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}

      {hidden > 0 ? (
        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-sage">
          A product stays hidden until it has at least one photograph — that rule is enforced by
          the system, not by this screen, so a product can never go live with an empty gallery.
        </p>
      ) : null}
    </>
  );
}
