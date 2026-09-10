/**
 * Shown while a screen's data is being read.
 *
 * Skeleton rather than a spinner: the shape of what is coming reduces the
 * sense of waiting, and it keeps the layout from jumping when content lands.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="mb-8 h-10 w-64 animate-pulse rounded-md bg-admin-sunken" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-md bg-admin-sunken" />
        ))}
      </div>
      <div className="mt-6 h-56 animate-pulse rounded-md bg-admin-sunken" />
    </div>
  );
}
