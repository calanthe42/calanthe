import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    robots: { index: false },
    title: t.meta.checkout,
  };
}

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
