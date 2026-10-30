import { notFound, redirect } from "next/navigation";

/** Moved to /admin/costs/buy/[id]. */
export default async function OldCostItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();
  redirect(`/admin/costs/buy/${numericId}`);
}
