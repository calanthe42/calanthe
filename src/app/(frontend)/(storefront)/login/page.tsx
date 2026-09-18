import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerLogin } from "@/components/commerce/CustomerLogin";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getCustomerSession } from "@backend/actions/account";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCustomerSession()) redirect("/account");

  return (
    <main className="mx-auto max-w-6xl gutter section-pad">
      <Reveal className="mb-10 max-w-md">
        <Eyebrow>Your account</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">Welcome back.</h1>
      </Reveal>
      <CustomerLogin />
    </main>
  );
}
