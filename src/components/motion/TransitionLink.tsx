"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type TransitionLinkProps = React.ComponentPropsWithoutRef<typeof Link>;

/**
 * Same-document View Transition navigation (morphs elements sharing a
 * view-transition-name). Falls back to normal Link behavior for
 * unsupported browsers, modified clicks (new tab), non-string hrefs,
 * targeted links, and reduced motion.
 */
export function TransitionLink({ href, onClick, target, ...props }: TransitionLinkProps) {
  const router = useRouter();

  return (
    <Link
      href={href}
      target={target}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        const modified =
          e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
        if (
          modified ||
          target ||
          typeof href !== "string" ||
          typeof document === "undefined" ||
          !("startViewTransition" in document) ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          return;
        }
        e.preventDefault();
        document.startViewTransition(() => {
          router.push(href);
        });
      }}
      {...props}
    />
  );
}
