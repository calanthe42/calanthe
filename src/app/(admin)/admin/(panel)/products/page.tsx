import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Media, Product } from "@/payload-types";
import { formatFils } from "@/lib/money";
import {
  ActionLink,
  Banner,
  DataList,
  DataRow,
  EmptyState,
  FilterBar,
  FilterField,
  FilterSelect,
  PageHeader,
  Pill,
  RowAction,
  Thumb,
  filterInputClass,
} from "@admin/components/ui";
import { getAdminSession } from "@backend/data/admin-session";
import { PRODUCT_CATEGORIES } from "@backend/domain/product-form";

/**
 * The catalogue as the owner sees it — including hidden products, which is
 * the whole difference from the storefront query.
 *
 * EVERY ROW CARRIES ITS OWN EDIT BUTTON. The product name was a link before,
 * and nothing else was: an owner looking for "how do I change this price?"
 * had to guess that a name is clickable. Now the action is a button, on the
 * row, at every screen width.
 *
 * MONEY IS SHOWN IN AED. The database stores integer fils and that does not
 * change; `formatFils` converts at the edge.
 */

export const metadata = { title: "Products" };

const AVAILABILITY = [
  { value: "live", label: "Live on the shop" },
  { value: "hidden", label: "Hidden" },
  { value: "no-photos", label: "Missing photos" },
] as const;

const HIGHLIGHTS = [
  { value: "featured", label: "Featured" },
  { value: "newArrival", label: "New arrival" },
  { value: "bestseller", label: "Bestseller" },
  { value: "seasonal", label: "Seasonal" },
] as const;

const SORTS = [
  { value: "shop", label: "Shop order" },
  { value: "name", label: "Name (A–Z)" },
  { value: "price-high", label: "Price (high to low)" },
  { value: "price-low", label: "Price (low to high)" },
  { value: "recent", label: "Recently edited" },
] as const;

type HighlightKey = (typeof HIGHLIGHTS)[number]["value"];

const SORTERS: Record<string, (a: Product, b: Product) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  "price-high": (a, b) => Number(b.priceFils) - Number(a.priceFils),
  "price-low": (a, b) => Number(a.priceFils) - Number(b.priceFils),
  recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

const categoryLabel = (value: string) =>
  PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value;

function cardPhoto(product: Product): Media | undefined {
  const first = (product.images ?? [])[0]?.image;
  return typeof first === "object" && first ? first : undefined;
}

type Search = {
  q?: string;
  availability?: string;
  category?: string;
  highlight?: string;
  sort?: string;
  deleted?: string;
};

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const {
    q = "",
    availability = "",
    category = "",
    highlight = "",
    sort = "shop",
    deleted,
  } = await searchParams;

  const [session, payload] = await Promise.all([getAdminSession(), getPayload({ config })]);
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const isOwner = Boolean(session?.isAdmin);

  /* The catalogue is small (tens, not thousands): one read, then filter and
     sort here, so every count on the page agrees with every other. */
  const result = await payload.find({
    collection: "products",
    sort: "sortOrder",
    limit: 500,
    depth: 1,
    user,
    overrideAccess: false,
  });
  const all = result.docs;

  const query = q.trim().toLowerCase();
  const highlightKey = HIGHLIGHTS.find((h) => h.value === highlight)?.value as HighlightKey | undefined;

  const products = all
    .filter((p) => {
      const photos = (p.images ?? []).length;
      if (query && ![p.name, p.slug, p.shortDescription ?? ""].some((v) => v.toLowerCase().includes(query))) {
        return false;
      }
      if (availability === "live" && !p.available) return false;
      if (availability === "hidden" && p.available) return false;
      if (availability === "no-photos" && photos > 0) return false;
      if (category && p.category !== category) return false;
      if (highlightKey && !p[highlightKey]) return false;
      return true;
    })
    .sort(SORTERS[sort] ?? (() => 0));

  const hidden = all.filter((p) => !p.available).length;
  const withoutPhotos = all.filter((p) => (p.images ?? []).length === 0).length;
  const filtering = Boolean(query || availability || category || highlightKey || sort !== "shop");

  return (
    <>
      <PageHeader
        title="Products"
        breadcrumb={[{ label: "Shop" }, { label: "Products" }]}
        description={
          all.length === 0
            ? "Your arrangements, and what customers see."
            : `${all.length} arrangement${all.length === 1 ? "" : "s"} · ${all.length - hidden} live · ${hidden} hidden${
                withoutPhotos > 0 ? ` · ${withoutPhotos} missing photos` : ""
              }`
        }
        action={
          isOwner ? (
            <ActionLink href="/admin/products/new" variant="primary">
              + Add product
            </ActionLink>
          ) : undefined
        }
      />

      {deleted ? <Banner>Product deleted.</Banner> : null}

      {all.length === 0 ? (
        <EmptyState
          title="No products yet"
          message="Your arrangements will appear here once you add the first one."
          action={
            isOwner ? (
              <ActionLink href="/admin/products/new" variant="primary">
                Add your first product
              </ActionLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <FilterBar action="/admin/products" active={filtering}>
            <FilterField label="Search" name="q" wide>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="Name or web address" className={filterInputClass} />
            </FilterField>
            <FilterField label="Availability" name="availability">
              <FilterSelect name="availability" value={availability} options={AVAILABILITY} anyLabel="All products" />
            </FilterField>
            <FilterField label="Category" name="category">
              <FilterSelect name="category" value={category} options={PRODUCT_CATEGORIES} anyLabel="All categories" />
            </FilterField>
            <FilterField label="Highlight" name="highlight">
              <FilterSelect name="highlight" value={highlight} options={HIGHLIGHTS} />
            </FilterField>
            <FilterField label="Sort by" name="sort">
              <FilterSelect name="sort" value={sort} options={SORTS} anyLabel={null} />
            </FilterField>
          </FilterBar>

          {products.length === 0 ? (
            <EmptyState
              title="Nothing matches those filters"
              message="Try a shorter search word, or clear the filters."
              action={<ActionLink href="/admin/products">Clear filters</ActionLink>}
            />
          ) : (
            <>
              {filtering ? (
                <p className="mb-3 text-xs text-sage" aria-live="polite">
                  Showing {products.length} of {all.length}
                </p>
              ) : null}
              <DataList label="Products">
                {products.map((product) => {
                  const photo = cardPhoto(product);
                  const photos = (product.images ?? []).length;
                  const highlights = HIGHLIGHTS.filter((h) => product[h.value]).map((h) =>
                    h.value === "newArrival" ? "New" : h.label,
                  );
                  const editHref = `/admin/products/${product.id}/edit`;
                  return (
                    <DataRow
                      key={product.id}
                      leading={
                        <Thumb
                          src={photo?.sizes?.thumbnail?.url ?? photo?.url}
                          alt={photo?.alt}
                        />
                      }
                      title={
                        <Link href={editHref} className="hover:underline">
                          {product.name}
                        </Link>
                      }
                      subtitle={product.shortDescription || `/product/${product.slug}`}
                      meta={
                        <>
                          <span className="font-medium tabular-nums text-olive">
                            {formatFils(Number(product.priceFils))}
                            {product.compareAtPriceFils ? (
                              <span className="ml-1.5 font-normal text-sage line-through">
                                {formatFils(Number(product.compareAtPriceFils))}
                              </span>
                            ) : null}
                          </span>
                          <span>{categoryLabel(product.category)}</span>
                          {product.available ? <Pill tone="done">Live</Pill> : <Pill>Hidden</Pill>}
                          {highlights.length > 0 ? <span>{highlights.join(" · ")}</span> : null}
                          {photos === 0 ? (
                            <Pill tone="attention">No photos</Pill>
                          ) : (
                            <span>
                              {photos} photo{photos === 1 ? "" : "s"}
                            </span>
                          )}
                        </>
                      }
                      actions={
                        <>
                          <RowAction href={editHref} variant="primary" label={`${isOwner ? "Edit" : "Open"} ${product.name}`}>
                            {isOwner ? "Edit" : "Open"}
                          </RowAction>
                          {product.available ? (
                            <RowAction href={`/product/${product.slug}`} external label={`View ${product.name} on the shop`}>
                              View ↗
                            </RowAction>
                          ) : null}
                        </>
                      }
                    />
                  );
                })}
              </DataList>
            </>
          )}

          {hidden > 0 ? (
            <p className="mt-4 max-w-2xl text-xs leading-relaxed text-sage">
              A product stays hidden until it has at least one photo and “Available to buy” is
              ticked. That rule is enforced by the system itself, so a product can never go live
              with an empty gallery.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
