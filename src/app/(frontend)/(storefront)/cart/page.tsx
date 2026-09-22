import { redirect } from "next/navigation";

/**
 * Never reached in practice: next.config.ts redirects /cart before any page
 * renders (see the note there). Kept so the route cannot 404 if that
 * redirect is ever removed.
 */
export default function CartPage() {
  redirect("/checkout");
}
