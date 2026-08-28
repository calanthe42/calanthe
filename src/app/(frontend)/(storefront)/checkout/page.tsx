import type { Metadata } from "next";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-6xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>Checkout</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          Almost there.
        </h1>
      </Reveal>
      <CheckoutForm />
    </main>
  );
}
