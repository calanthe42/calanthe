import { redirect } from "next/navigation";

/** Moved to /admin/costs/buy/new; a name the product editor passed comes along. */
export default async function OldNewCostItemPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  redirect(`/admin/costs/buy/new${name?.trim() ? `?name=${encodeURIComponent(name.trim())}` : ""}`);
}
