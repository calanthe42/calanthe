import { redirect } from "next/navigation";

/** The cart lives in the slide-in drawer; direct visits go to checkout. */
export default function CartPage() {
  redirect("/checkout");
}
