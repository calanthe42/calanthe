"use client";

/**
 * The admin's error boundary.
 *
 * States plainly that nothing was lost, because the first question a business
 * owner has when a screen breaks is whether her data survived. The digest is
 * shown so a failure can be found in the server logs without guesswork.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-md border border-burgundy/30 bg-white px-6 py-14 text-center">
      <p className="font-display text-2xl font-light text-olive">Something went wrong</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sage">
        This screen could not load. Nothing has been changed or lost — your orders, products and
        customers are all safe.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-md bg-burnt-orange px-5 text-sm font-medium text-cream"
        >
          Try again
        </button>
        <a
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-md border border-hairline px-5 text-sm text-olive"
        >
          Back to dashboard
        </a>
      </div>
      {error.digest ? (
        <p className="mt-4 text-xs text-sage">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
