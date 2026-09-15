import type { Metadata } from "next";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

/* The heading lives in CheckoutForm: "Almost there." is only true while there
   is something in the cart, and the empty and confirmed states each need
   their own single h1. */
export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-6xl gutter section-pad">
      <CheckoutForm />
    </main>
  );
}
