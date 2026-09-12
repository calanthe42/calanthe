import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Media, Product } from "@/payload-types";
import { getAdminI18n } from "@admin/i18n/server";
import type { MessageKey } from "@admin/i18n/translate";
import { RowMenu } from "@admin/ui/ActionButton";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { Thumb } from "@admin/ui/Content";
import { FilterBar, FilterSelect } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { EmptyState, Notice } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { deleteProduct } from "@backend/actions/admin";
import { getAdminSession } from "@backend/data/admin-session";
import { PRODUCT_CATEGORIES } from "@backend/domain/product-form";

/**
 * The catalogue as the owner sees it — hidden products included, which is the
 * whole difference from the storefront query.
 *
 * Every row carries a visible Edit button (not just a clickable name), a View
 * link when the product is live, and a ⋯ menu for the rest. Prices are shown in
 * AED; the database's integer fils are converted only at the edge.
 *
 * The catalogue is tens of products, not thousands: one read as the signed-in
 * user, then filter, sort and page here, so every count on the page agrees.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("products.title") };
}

const PAGE_SIZE = 25;
const HIGHLIGHTS = ["featured", "bestseller", "newArrival", "seasonal"] as const;
type Highlight = (typeof HIGHLIGHTS)[number];

const FLAG_LABEL: Record<Highlight, MessageKey> = {
  featured: "products.flags.featured",
  bestseller: "products.flags.bestseller",
  newArrival: "products.flags.newArrival",
  seasonal: "products.flags.seasonal",
};

const SORTERS: Record<string, (a: Product, b: Product) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  "price-high": (a, b) => Number(b.priceFils) - Number(a.priceFils),
  "price-low": (a, b) => Number(a.priceFils) - Number(b.priceFils),
  recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

const photoCount = (p: Product) => (p.images ?? []).length;
const isOutOfStock = (p: Product) => Boolean(p.available && p.trackStock) && Number(p.stock ?? 0) <= 0;

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
  page?: string;
  deleted?: string;
};

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const { q = "", availability = "", category = "", highlight = "", sort = "shop", deleted } = params;

  const [i18n, session, payload] = await Promise.all([getAdminI18n(), getAdminSession(), getPayload({ config })]);
  const { t, plural, label, money } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const isOwner = Boolean(session?.isAdmin);

  const result = await payload.find({
    collection: "products",
    sort: "sortOrder",
    limit: 1000,
    depth: 1,
    user,
    overrideAccess: false,
  });
  const all = result.docs;

  const query = q.trim().toLowerCase();
  const highlightKey = (HIGHLIGHTS as readonly string[]).includes(highlight) ? (highlight as Highlight) : undefined;

  const matching = all
    .filter((p) => {
      if (query && ![p.name, p.slug, p.shortDescription ?? ""].some((v) => v.toLowerCase().includes(query))) return false;
      if (availability === "live" && !(p.available && photoCount(p) > 0)) return false;
      if (availability === "hidden" && p.available && photoCount(p) > 0) return false;
      if (availability === "no-photos" && photoCount(p) > 0) return false;
      if (availability === "out-of-stock" && !isOutOfStock(p)) return false;
      if (category && p.category !== category) return false;
      if (highlightKey && !p[highlightKey]) return false;
      return true;
    })
    .sort(SORTERS[sort] ?? (() => 0));

  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(parsePage(params.page), totalPages);
  const rows = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const live = all.filter((p) => p.available && photoCount(p) > 0).length;
  const filtering = Boolean(query || availability || category || highlightKey || sort !== "shop");
  const href = (p: number) => listHref("/admin/products", { q, availability, category, highlight, sort: sort === "shop" ? "" : sort, page: p });

  const addButton = isOwner ? (
    <ButtonLink href="/admin/products/new" variant="primary" icon="plus">
      {t("products.add")}
    </ButtonLink>
  ) : undefined;

  return (
    <>
      <PageHeader
        title={t("products.title")}
        breadcrumbs={[{ label: t("nav.sections.catalog") }, { label: t("products.title") }]}
        description={
          all.length === 0
            ? t("products.description")
            : t("products.summary", { total: all.length, live, hidden: all.length - live })
        }
        actions={addButton}
      />

      {deleted ? <Notice tone="success">{t("products.deleted")}</Notice> : null}

      {all.length === 0 ? (
        <EmptyState
          icon="flower"
          title={t("products.empty.title")}
          body={t("products.empty.body")}
          action={
            isOwner ? (
              <ButtonLink href="/admin/products/new" variant="primary" icon="plus">
                {t("products.empty.cta")}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <FilterBar action="/admin/products" active={filtering} searchValue={q} searchPlaceholder={t("products.filters.searchPlaceholder")}>
            <FilterSelect
              id="availability"
              label={t("products.filters.availability")}
              value={availability}
              placeholder={t("products.filters.allProducts")}
              options={[
                { value: "live", label: t("products.filters.live") },
                { value: "hidden", label: t("products.filters.hidden") },
                { value: "no-photos", label: t("products.filters.noPhotos") },
                { value: "out-of-stock", label: t("products.filters.outOfStock") },
              ]}
            />
            <FilterSelect
              id="category"
              label={t("products.filters.category")}
              value={category}
              placeholder={t("products.filters.allCategories")}
              options={PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: label("category", c.value) }))}
            />
            <FilterSelect
              id="highlight"
              label={t("products.filters.highlight")}
              value={highlight}
              placeholder={t("products.filters.anyHighlight")}
              options={HIGHLIGHTS.map((h) => ({ value: h, label: t(FLAG_LABEL[h]) }))}
            />
            <FilterSelect
              id="sort"
              label={t("products.filters.sort")}
              value={sort}
              options={[
                { value: "shop", label: t("products.filters.sortShop") },
                { value: "name", label: t("products.filters.sortName") },
                { value: "price-high", label: t("products.filters.sortPriceHigh") },
                { value: "price-low", label: t("products.filters.sortPriceLow") },
                { value: "recent", label: t("products.filters.sortRecent") },
              ]}
            />
          </FilterBar>

          {matching.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("products.empty.noMatch")}
              body={t("products.empty.noMatchBody")}
              action={<ButtonLink href="/admin/products">{t("common.clearFilters")}</ButtonLink>}
            />
          ) : (
            <>
              {filtering ? (
                <p className="mb-2 text-xs text-ink-3" aria-live="polite">
                  {t("common.showing", { shown: matching.length, total: all.length })}
                </p>
              ) : null}
              <Table
                caption={t("products.title")}
                columns={[
                  { key: "product", label: t("products.columns.product") },
                  { key: "price", label: t("products.columns.price"), align: "end" },
                  { key: "category", label: t("products.columns.category") },
                  { key: "status", label: t("products.columns.status") },
                  { key: "highlights", label: t("products.columns.highlights") },
                  { key: "actions", label: t("common.actions"), hidden: true },
                ]}
              >
                {rows.map((product) => {
                  const photo = cardPhoto(product);
                  const photos = photoCount(product);
                  const isLive = Boolean(product.available) && photos > 0;
                  const editHref = `/admin/products/${product.id}/edit`;
                  const storeHref = `/product/${product.slug}`;
                  const flags = HIGHLIGHTS.filter((h) => product[h]).map((h) => t(FLAG_LABEL[h]));
                  const name = product.name;

                  return (
                    <Tr key={product.id}>
                      <Td primary>
                        <div className="flex min-w-0 items-center gap-3">
                          <Thumb src={photo?.sizes?.thumbnail?.url ?? photo?.url} alt={photo?.alt} />
                          <div className="min-w-0">
                            <Link href={editHref} className="block truncate font-medium text-ink hover:underline">
                              {name}
                            </Link>
                            <span className="block max-w-xs truncate text-xs text-ink-3">
                              {product.shortDescription || plural("products.photosCount", photos)}
                            </span>
                          </div>
                        </div>
                      </Td>
                      <Td label={t("products.columns.price")} align="end">
                        <span className="font-medium tabular">{money(Number(product.priceFils))}</span>
                        {product.compareAtPriceFils ? (
                          <span className="block text-xs text-ink-3 line-through tabular">{money(Number(product.compareAtPriceFils))}</span>
                        ) : null}
                      </Td>
                      <Td label={t("products.columns.category")} className="text-ink-2">
                        {label("category", product.category)}
                      </Td>
                      <Td label={t("products.columns.status")}>
                        <div className="flex flex-wrap justify-end gap-1.5 md:justify-start">
                          {photos === 0 ? (
                            <Badge tone="warning" dot>{t("products.status.noPhoto")}</Badge>
                          ) : isLive ? (
                            <Badge tone="success" dot>{t("products.status.live")}</Badge>
                          ) : (
                            <Badge dot>{t("products.status.hidden")}</Badge>
                          )}
                          {isOutOfStock(product) ? <Badge tone="danger">{t("products.status.outOfStock")}</Badge> : null}
                        </div>
                      </Td>
                      <Td label={t("products.columns.highlights")} className="text-xs text-ink-2">
                        {flags.length > 0 ? flags.join(" · ") : "—"}
                      </Td>
                      <Td actions>
                        <ButtonLink
                          href={editHref}
                          size="sm"
                          icon={isOwner ? "edit" : "eye"}
                          aria-label={t(isOwner ? "products.editLabel" : "products.openLabel", { name })}
                        >
                          {isOwner ? t("common.edit") : t("common.open")}
                        </ButtonLink>
                        {isLive ? (
                          <ButtonLink
                            href={storeHref}
                            external
                            size="sm"
                            variant="ghost"
                            icon="store"
                            aria-label={`${t("products.viewLabel", { name })} ${t("common.opensNewTab")}`}
                          >
                            {t("common.view")}
                          </ButtonLink>
                        ) : null}
                        <RowMenu
                          label={t("common.moreActionsFor", { name })}
                          links={[
                            { label: isOwner ? t("common.edit") : t("common.open"), href: editHref, icon: isOwner ? "edit" : "eye" },
                            ...(isLive ? [{ label: t("common.viewOnStore"), href: storeHref, icon: "store" as const, external: true }] : []),
                          ]}
                          destructive={
                            isOwner
                              ? {
                                  label: t("common.delete"),
                                  title: t("products.deleteTitle", { name }),
                                  body: t("products.deleteBody"),
                                  confirmLabel: t("products.deleteConfirm"),
                                  action: deleteProduct.bind(null, product.id),
                                }
                              : undefined
                          }
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </Table>
              <Pagination page={page} totalPages={totalPages} hrefFor={href} />
            </>
          )}

          {all.length - live > 0 ? <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ink-3">{t("products.hiddenNote")}</p> : null}
        </>
      )}
    </>
  );
}
