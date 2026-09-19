import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * The frame every customer auth screen sits in.
 *
 * ONE COMPOSITION, FIVE SCREENS. Sign in, create account, verify, forgot and
 * reset are the same object seen at different moments, so they share a
 * frame: a small mark, an eyebrow, one large Cormorant line, a short
 * paragraph, the form, then the way out to the sibling screens. Nothing here
 * is a card — the page is the card, which is how the rest of the storefront
 * is built.
 *
 * Narrow by design (26rem): these forms are two or three fields, and a wide
 * measure makes a short form look unfinished. Centred vertically on a tall
 * screen, top-aligned on a short one, so a phone keyboard never pushes the
 * heading off.
 */
export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[70svh] w-full max-w-md flex-col justify-center gutter py-14 lg:py-20">
      <Monogram className="w-10 text-burnt-orange" />
      <Eyebrow className="mt-6">{eyebrow}</Eyebrow>
      <h1 className="mt-3 font-display text-[2.25rem] font-light leading-[1.05] text-olive lg:text-[2.75rem]">
        {title}
      </h1>
      {intro && (
        <p className="mt-4 text-base leading-relaxed text-ink-muted">{intro}</p>
      )}
      <div className="mt-9">{children}</div>
      {footer && (
        <div className="mt-10 border-t border-hairline pt-6 text-sm text-ink-muted">
          {footer}
        </div>
      )}
    </main>
  );
}

/** The quiet link between sign in / create account / forgot password. */
export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-olive underline decoration-hairline underline-offset-4 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
    >
      {children}
    </Link>
  );
}
