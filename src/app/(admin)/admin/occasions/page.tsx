import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { ActionLink, EmptyState, PageHeader, Table, Td } from "@admin/components/ui";

export const metadata = { title: "Occasions" };

export default async function AdminOccasionsPage() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const [occasions, products] = await Promise.all([
    payload.find({ collection: "occasions", limit: 100, sort: "sortOrder", depth: 0, user }),
    payload.find({ collection: "products", limit: 300, depth: 1, user }),
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
        description="Why someone is buying — the one real way the shop is grouped."
        action={
          <ActionLink href="/admin/occasions/new" variant="primary">
            Add occasion
          </ActionLink>
        }
      />

      {occasions.docs.length === 0 ? (
        <EmptyState
          title="No occasions yet"
          message="Occasions group the shop for customers — birthdays, love, new arrivals."
          action={
            <ActionLink href="/admin/occasions/new" variant="primary">
              Add your first occasion
            </ActionLink>
          }
        />
      ) : (
        <Table head={["Occasion", "Web address", "Products", "Order", "Visible"]}>
          {occasions.docs.map((occasion) => (
            <tr key={occasion.id} className="border-b border-hairline/50 last:border-0">
              <Td>
                <Link
                  href={`/admin/occasions/${occasion.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {occasion.name}
                </Link>
              </Td>
              <Td className="text-sage">/{occasion.slug}</Td>
              <Td className="tabular-nums">{counts.get(occasion.id) ?? 0}</Td>
              <Td className="tabular-nums text-sage">{occasion.sortOrder ?? 0}</Td>
              <Td>
                <span className={occasion.active ? "text-olive" : "text-sage"}>
                  {occasion.active ? "Visible" : "Hidden"}
                </span>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
