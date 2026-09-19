import { redirect } from "next/navigation";

/**
 * `/login` predates the `/account/*` family and is kept so any link, bookmark
 * or printed card pointing at it still lands somewhere correct.
 */
export default function LegacyLoginPage() {
  redirect("/account/login");
}
