/**
 * The homepage's own loading state: the shape and colour of the hero.
 *
 * The shared storefront skeleton is a cream page that starts below the bar.
 * On the homepage that meant cream nav text on cream for up to a second, and
 * then the whole page jumping up 102px when the hero arrived (the layout
 * shift Lighthouse measured). This holds the hero's place instead: dark
 * olive, full height, already tucked under the bar.
 */
export default function Loading() {
  return (
    <main>
      <div
        aria-hidden
        className="h-svh min-h-[600px] bg-olive"
        style={{ marginTop: "calc(-1 * var(--header-h))" }}
      />
    </main>
  );
}
