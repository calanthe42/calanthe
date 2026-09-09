"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { customerLogin } from "@backend/actions/account";
import { Button } from "@/components/ui/Button";

/**
 * Customer sign-in.
 *
 * Uses Payload's own login through a server action, so the password never
 * travels anywhere but the server and the session is the same one the rest of
 * the system understands.
 */
export function CustomerLogin() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await customerLogin(data);
          if (result.ok) {
            router.push("/account");
            router.refresh();
          } else {
            setError(result.message);
          }
        });
      }}
      className="max-w-sm space-y-4"
      noValidate
    >
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm text-olive">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-12 w-full rounded-sm border border-hairline bg-cream/40 px-3 text-base text-olive"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm text-olive">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-12 w-full rounded-sm border border-hairline bg-cream/40 px-3 text-base text-olive"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm leading-relaxed text-burgundy">
          {error}
        </p>
      ) : null}

      <Button variant="primary" className="w-full" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-xs leading-relaxed text-sage">
        You do not need an account to order — every arrangement can be bought as a guest.
      </p>
    </form>
  );
}
