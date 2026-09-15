import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { getAdminI18n } from "@admin/i18n/server";
import { RowMenu } from "@admin/ui/ActionButton";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { Thumb } from "@admin/ui/Content";
import { FilterBar, FilterSelect } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState, Notice } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { deleteOccasion } from "@backend/actions/admin";
import { getAdminSession } from "@backend/data/admin-session";

/**
 * Occasions — birthdays, love, new arrivals — each with its own store page.
 *
 * Product counts are computed from the products themselves, not stored, so
 * they can never drift. Deletion is refused while any product still uses an
 * occasion (the action says how many); hiding is always available.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("occasions.title") };
}

export default async function AdminOccasionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; created?: string; deleted?: string }>;
}) {
  const { q = "", status = "", created, deleted } = await searchParams;
  const [i18n, session, payload] = await Promise.all([getAdminI18n(), getAdminSession(), getPayload({ config })]);
  const { t } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const isOwner = Boolean(session?.isAdmin);

  const [occasions, products] = await Promise.all([
    payload.find({ collection: "occasions", limit: 500, sort: "sortOrder", depth: 1, user, overrideAccess: false }),
    payload.find({ collection: "products", limit: 1000, depth: 0, select: { occasions: true }, user, overrideAccess: false }),
  ]);

  const counts = new Map<number, number>();
  for (const product of products.docs) {
    for (const occasion of product.occasions ?? []) {
      const id = typeof occasion === "object" && occasion ? occasion.id : occasion;
      if (typeof id === "number") counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const query = q.trim().toLowerCase();
  const all = occasions.docs;
  const rows = all.filter((o) => {
    if (query && ![o.name, o.slug, o.description ?? ""].some((v) => v.toLowerCase().includes(query))) return false;
    if (status === "visible" && !o.active) return false;
    if (status === "hidden" && o.active) return false;
    return true;
  });
  const filtering = Boolean(query || status);

  return (
    <>
      <PageHeader
        title={t("occasions.title")}
        breadcrumbs={[{ label: t("nav.sections.catalog") }, { label: t("occasions.title") }]}
        description={t("occasions.description")}
        actions={
          isOwner ? (
            <ButtonLink href="/admin/occasions/new" variant="primary" icon="plus">
              {t("occasions.add")}
            </ButtonLink>
          ) : undefined
        }
      />

      {created ? <Notice tone="success">{t("occasions.created")}</Notice> : null}
      {deleted ? <Notice tone="success">{t("occasions.deleted")}</Notice> : null}

      {all.length === 0 ? (
        <EmptyState
          icon="occasion"
          title={t("occasions.empty.title")}
          body={t("occasions.empty.body")}
          action={
            isOwner ? (
              <ButtonLink href="/admin/occasions/new" variant="primary" icon="plus">
                {t("occasions.empty.cta")}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <FilterBar action="/admin/occasions" active={filtering} searchValue={q} searchPlaceholder={t("occasions.filters.searchPlaceholder")}>
            <FilterSelect
              id="status"
              label={t("occasions.filters.status")}
              value={status}
              placeholder={t("occasions.filters.all")}
              options={[
                { value: "visible", label: t("occasions.filters.visible") },
                { value: "hidden", label: t("occasions.filters.hidden") },
              ]}
            />
          </FilterBar>

          {rows.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("occasions.empty.noMatch")}
              body={t("occasions.empty.noMatchBody")}
              action={<ButtonLink href="/admin/occasions">{t("common.clearFilters")}</ButtonLink>}
            />
          ) : (
            <Table
              caption={t("occasions.title")}
              columns={[
                { key: "occasion", label: t("occasions.columns.occasion") },
                { key: "products", label: t("occasions.columns.products"), align: "end" },
                { key: "status", label: t("occasions.columns.status") },
                { key: "order", label: t("occasions.columns.order"), align: "end" },
                { key: "actions", label: t("common.actions"), hidden: true },
              ]}
            >
              {rows.map((occasion) => {
                const image = typeof occasion.image === "object" && occasion.image ? occasion.image : undefined;
                const editHref = `/admin/occasions/${occasion.id}/edit`;
                const storeHref = `/occasions/${occasion.slug}`;
                const name = occasion.name;
                return (
                  <Tr key={occasion.id}>
                    <Td primary>
                      <div className="flex min-w-0 items-center gap-3">
                        <Thumb shape="square" src={image?.sizes?.thumbnail?.url ?? image?.url} alt={image?.alt} />
                        <div className="min-w-0">
                          <Link href={editHref} className="block truncate font-medium text-ink hover:underline">
                            {name}
                          </Link>
                          <span className="block max-w-md truncate text-xs text-ink-3">
                            {occasion.description || t("occasions.noDescription")}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td label={t("occasions.columns.products")} align="end" className="tabular">
                      {counts.get(occasion.id) ?? 0}
                    </Td>
                    <Td label={t("occasions.columns.status")}>
                      {occasion.active ? (
                        <Badge tone="success" dot>{t("occasions.status.visible")}</Badge>
                      ) : (
                        <Badge dot>{t("occasions.status.hidden")}</Badge>
                      )}
                    </Td>
                    <Td label={t("occasions.columns.order")} align="end" className="tabular text-ink-2">
                      {occasion.sortOrder ?? 0}
                    </Td>
                    <Td actions>
                      <ButtonLink href={editHref} size="sm" icon="edit" aria-label={t("occasions.editLabel", { name })}>
                        {t("common.edit")}
                      </ButtonLink>
                      {occasion.active ? (
                        <ButtonLink
                          href={storeHref}
                          external
                          size="sm"
                          variant="ghost"
                          icon="store"
                          aria-label={`${t("occasions.viewLabel", { name })} ${t("common.opensNewTab")}`}
                        >
                          {t("common.view")}
                        </ButtonLink>
                      ) : null}
                      <RowMenu
                        label={t("common.moreActionsFor", { name })}
                        links={[
                          { label: t("common.edit"), href: editHref, icon: "edit" },
                          ...(occasion.active ? [{ label: t("common.viewOnStore"), href: storeHref, icon: "store" as const, external: true }] : []),
                        ]}
                        destructive={
                          isOwner
                            ? {
                                label: t("common.delete"),
                                title: t("occasions.form.deleteTitle", { name }),
                                body: t("occasions.form.deleteBody"),
                                confirmLabel: t("occasions.form.deleteConfirm"),
                                action: deleteOccasion.bind(null, occasion.id),
                              }
                            : undefined
                        }
                      />
                    </Td>
                  </Tr>
                );
              })}
            </Table>
          )}
        </>
      )}
    </>
  );
}
