"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { customerLogout } from "@backend/actions/account";

export function CustomerLogout() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await customerLogout();
          router.push("/");
          router.refresh();
        })
      }
      className="min-h-11 text-sm text-sage underline underline-offset-4 hover:text-olive disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
