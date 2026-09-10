"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminLogin } from "@backend/actions/admin-auth";

/**
 * The sign-in form. The password goes to a server action and nowhere else;
 * the session cookie is set on the server as httpOnly, so no script on the
 * page can read it.
 */
export function AdminLoginForm({ next }: { next: string }) {
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
          const result = await adminLogin(data);
          if (result.ok) {
            router.replace(result.redirectTo);
            router.refresh();
          } else {
            setError(result.message);
          }
        });
      }}
      className="mt-6 space-y-4"
      noValidate
    >
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium text-olive">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-base text-olive"
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-olive">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-base text-olive"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm leading-relaxed text-burgundy"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-burnt-orange px-5 text-sm font-medium text-cream transition-opacity disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
