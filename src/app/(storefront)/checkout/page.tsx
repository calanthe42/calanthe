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
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-20">
      <Reveal className="mb-10">
        <Eyebrow>Checkout</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light text-olive lg:text-5xl">
          Almost there.
        </h1>
      </Reveal>
      <CheckoutForm />
    </main>
  );
}
