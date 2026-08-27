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
    <main className="mx-auto max-w-4xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>Your Atelier</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          Account
        </h1>
      </Reveal>
      <AccountClient />
    </main>
  );
}
