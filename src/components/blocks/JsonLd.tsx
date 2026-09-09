/**
 * Emits one structured-data block. Server component: the JSON is built
 * on the server and shipped as markup, so it costs the browser nothing
 * to parse and nothing to hydrate.
 *
 * The payload is our own object, serialised by JSON.stringify — never
 * user input — and `<` is escaped so a stray character in a product
 * name can never close the script tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\u003c"),
      }}
    />
  );
}
