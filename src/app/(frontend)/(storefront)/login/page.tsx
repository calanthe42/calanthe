import type { Metadata } from "next";
import { LoginFlow } from "@/components/commerce/LoginFlow";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[70svh] max-w-md flex-col justify-center px-6 py-16">
      <LoginFlow />
    </main>
  );
}
