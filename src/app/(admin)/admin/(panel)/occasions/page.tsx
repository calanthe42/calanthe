import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import {
  ActionLink,
  Banner,
  DataList,
  DataRow,
  EmptyState,
  PageHeader,
  Pill,
  RowAction,
  Thumb,
} from "@admin/components/ui";
import { getAdminSession } from "@backend/data/admin-session";

export const metadata = { title: "Occasions" };

export default async function AdminOccasionsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; deleted?: string }>;
}) {
  const { created, deleted } = await searchParams;
  const [session, payload] = await Promise.all([getAdminSession(), getPayload({ config })]);
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const isOwner = Boolean(session?.isAdmin);

  const [occasions, products] = await Promise.all([
    payload.find({ collection: "occasions", limit: 200, sort: "sortOrder", depth: 1, user, overrideAccess: false }),
    payload.find({ collection: "products", limit: 1000, depth: 0, user, overrideAccess: false }),
  ]);

  /* Product counts per occasion, computed rather than stored. */
  const counts = new Map<number, number>();
  for (const product of products.docs) {
    for (const occasion of product.occasions ?? []) {
      const id = typeof occasion === "object" && occasion ? occasion.id : occasion;
      if (typeof id === "number") counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return (
    <>
      <PageHeader
        title="Occasions"
        breadcrumb={[{ label: "Shop" }, { label: "Occasions" }]}
        description="Why someone is buying — birthdays, love, new arrivals. Each occasion has its own page on the shop."
        action={
          isOwner ? (
            <ActionLink href="/admin/occasions/new" variant="primary">
              + Add occasion
            </ActionLink>
          ) : undefined
        }
      />

      {created ? <Banner>Occasion created.</Banner> : null}
      {deleted ? <Banner>Occasion deleted.</Banner> : null}

      {occasions.docs.length === 0 ? (
        <EmptyState
          title="No occasions yet"
          message="Occasions group the shop for customers — birthdays, love, new arrivals."
          action={
            isOwner ? (
              <ActionLink href="/admin/occasions/new" variant="primary">
                Add your first occasion
              </ActionLink>
            ) : undefined
          }
        />
      ) : (
        <DataList label="Occasions">
          {occasions.docs.map((occasion) => {
            const image = typeof occasion.image === "object" && occasion.image ? occasion.image : undefined;
            const count = counts.get(occasion.id) ?? 0;
            const editHref = `/admin/occasions/${occasion.id}/edit`;
            return (
              <DataRow
                key={occasion.id}
                leading={<Thumb shape="square" src={image?.sizes?.thumbnail?.url ?? image?.url} alt={image?.alt} />}
                title={
                  <Link href={editHref} className="hover:underline">
                    {occasion.name}
                  </Link>
                }
                subtitle={occasion.description || "No description yet"}
                meta={
                  <>
                    {occasion.active ? <Pill tone="done">Visible</Pill> : <Pill>Hidden</Pill>}
                    <span>
                      {count} product{count === 1 ? "" : "s"}
                    </span>
                    <span>/occasions/{occasion.slug}</span>
                    <span>Order {occasion.sortOrder ?? 0}</span>
                  </>
                }
                actions={
                  <>
                    <RowAction href={editHref} variant="primary" label={`Edit ${occasion.name}`}>
                      Edit
                    </RowAction>
                    {occasion.active ? (
                      <RowAction href={`/occasions/${occasion.slug}`} external label={`View ${occasion.name} on the shop`}>
                        View ↗
                      </RowAction>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </DataList>
      )}
    </>
  );
}
