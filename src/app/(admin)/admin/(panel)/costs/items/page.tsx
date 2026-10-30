import { redirect } from "next/navigation";

/**
 * "Flowers and materials" is now What you buy (/admin/costs/buy). The old
 * address keeps working for a bookmark, and keeps its search and filter.
 */
export default async function OldCostItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { q, archived } = await searchParams;
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (archived === "1") params.set("stopped", "1");
  const query = params.toString();
  redirect(`/admin/costs/buy${query ? `?${query}` : ""}`);
}
