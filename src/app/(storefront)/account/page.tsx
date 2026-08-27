import type { Metadata } from "next";
import { AccountClient } from "@/components/commerce/AccountClient";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 lg:py-20">
      <Reveal className="mb-10">
        <Eyebrow>Your Atelier</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light text-olive lg:text-5xl">
          Account
        </h1>
      </Reveal>
      <AccountClient />
    </main>
  );
}
